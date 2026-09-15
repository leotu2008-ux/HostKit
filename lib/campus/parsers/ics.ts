import { parseIcsDate } from "@/lib/campus/time";
import { decodeEntities, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * iCalendar (RFC 5545) — the one format nearly every campus calendar can
 * export. Handles folded lines, TZID/UTC/all-day dates, escaped text, and the
 * vendor extras Trumba and LiveWhale add (links, images, cancellations).
 * An RRULE event is expanded into one row per occurrence inside the
 * window, because a weekly seminar shown once is a weekly seminar
 * nobody finds.
 */

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

export type IcsOptions = {
  timeZone: string;
  pageUrl: string;
  /** Some calendars (BU's) write the local wall clock with a "Z" suffix. */
  utcIsLocal?: boolean;
};

export function parseIcs(text: string, opts: IcsOptions): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  let current: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) out.push(...toEvents(current, opts));
      current = null;
      continue;
    }
    if (current) {
      const prop = parseLine(line);
      if (prop) current.push(prop);
    }
  }
  return out;
}

/** Occurrences we will generate from one RRULE, whatever it claims. */
const MAX_OCCURRENCES = 200;
/** How far ahead to expand. selectUpcoming trims to the real window after. */
const EXPAND_DAYS = 120;

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * The starts an RRULE produces, beginning at `from`. Supports the parts
 * campus calendars actually use — FREQ, INTERVAL, COUNT, UNTIL, BYDAY —
 * and stops at the horizon, the count, or MAX_OCCURRENCES, whichever comes
 * first. Anything it can't read yields just the original start, which is
 * the old behaviour and never worse.
 *
 * Dates are the school's wall clock encoded as UTC (see lib/campus/time),
 * so every step uses the UTC getters and setters.
 */
export function expandRrule(rule: string, from: Date, horizon: Date): Date[] {
  const parts = new Map<string, string>();
  for (const piece of rule.split(";")) {
    const eq = piece.indexOf("=");
    if (eq > 0) parts.set(piece.slice(0, eq).toUpperCase(), piece.slice(eq + 1));
  }
  const freq = parts.get("FREQ")?.toUpperCase();
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return [from];

  const interval = Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1);
  const count = Number(parts.get("COUNT") ?? 0) || 0;
  const untilRaw = parts.get("UNTIL");
  // UNTIL is "20261231T235959Z" or "20261231"; compare on the day.
  const until = untilRaw
    ? new Date(Date.UTC(+untilRaw.slice(0, 4), +untilRaw.slice(4, 6) - 1, +untilRaw.slice(6, 8), 23, 59, 59))
    : null;
  const stop = until && until < horizon ? until : horizon;

  const byDay = (parts.get("BYDAY") ?? "")
    .split(",")
    .map((d) => WEEKDAYS[d.trim().slice(-2).toUpperCase()])
    .filter((d) => d !== undefined);

  const out: Date[] = [];
  const push = (date: Date) => {
    if (date > stop) return false;
    if (date >= from) out.push(date);
    return out.length < MAX_OCCURRENCES && (count === 0 || out.length < count);
  };

  if (freq === "WEEKLY" && byDay.length > 0) {
    // Walk week by week, emitting each named day in the week.
    const weekStart = new Date(from.getTime());
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    for (let week = 0; week < 60; week += 1) {
      for (const day of [...byDay].sort((a, b) => a - b)) {
        const at = new Date(weekStart.getTime());
        at.setUTCDate(weekStart.getUTCDate() + week * 7 * interval + day);
        at.setUTCHours(from.getUTCHours(), from.getUTCMinutes(), 0, 0);
        if (at < from) continue;
        if (!push(at)) return out;
      }
      const probe = new Date(weekStart.getTime());
      probe.setUTCDate(weekStart.getUTCDate() + (week + 1) * 7 * interval);
      if (probe > stop) break;
    }
    return out;
  }

  const at = new Date(from.getTime());
  for (let i = 0; i < MAX_OCCURRENCES; i += 1) {
    if (!push(new Date(at.getTime()))) break;
    if (freq === "DAILY") at.setUTCDate(at.getUTCDate() + interval);
    else if (freq === "WEEKLY") at.setUTCDate(at.getUTCDate() + 7 * interval);
    else if (freq === "MONTHLY") at.setUTCMonth(at.getUTCMonth() + interval);
    else at.setUTCFullYear(at.getUTCFullYear() + interval);
    if (at > stop) break;
  }
  return out;
}

function toEvents(props: Prop[], opts: IcsOptions): ParsedEvent[] {
  const base = toEvent(props, opts);
  if (!base) return [];

  const get = (name: string) => props.find((p) => p.name === name);
  const rule = get("RRULE")?.value.trim();
  if (!rule) return [base];

  const horizon = new Date(base.startsAt.getTime() + EXPAND_DAYS * 86_400_000);
  const skipped = new Set(
    props
      .filter((p) => p.name === "EXDATE")
      .flatMap((p) => p.value.split(","))
      .map((v) => v.trim().slice(0, 8)),
  );

  const length = base.endsAt ? base.endsAt.getTime() - base.startsAt.getTime() : null;
  const starts = expandRrule(rule, base.startsAt, horizon).filter(
    (d) => !skipped.has(d.toISOString().slice(0, 10).replace(/-/g, "")),
  );
  if (starts.length <= 1) return [base];

  return starts.map((startsAt) => ({
    ...base,
    // Each occurrence needs its own id; the UID is shared across the series.
    externalId: `${base.externalId}:${startsAt.toISOString().slice(0, 10)}`,
    startsAt,
    endsAt: length === null ? null : new Date(startsAt.getTime() + length),
  }));
}

function toEvent(props: Prop[], opts: IcsOptions): ParsedEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  const uid = get("UID")?.value.trim();
  const summary = get("SUMMARY")?.value;
  const start = get("DTSTART");
  if (!uid || !summary || !start) return null;
  if (get("STATUS")?.value.toUpperCase() === "CANCELLED") return null;
  if (get("X-LIVEWHALE-CANCELED")?.value === "1") return null;

  const when = (value: string) =>
    parseIcsDate(opts.utcIsLocal ? value.replace(/Z$/i, "") : value, opts.timeZone);
  const startAt = when(start.value);
  if (!startAt) return null;
  const end = get("DTEND");
  const endAt = end ? when(end.value) : null;
  const allDay =
    startAt.allDay ||
    get("X-MICROSOFT-CDO-ALLDAYEVENT")?.value.toUpperCase() === "TRUE" ||
    get("X-LIVEWHALE-ALL-DAY")?.value === "1";

  // Some feeds (Sidearm's athletics calendars) HTML-escape the "&" in links.
  const url = decodeEntities(
    get("URL")?.value.trim() ||
      get("X-TRUMBA-LINK")?.value.trim() ||
      firstHttpUrl(get("DESCRIPTION")?.value ?? "") ||
      opts.pageUrl,
  );
  const image =
    get("X-LIVEWHALE-IMAGE")?.value.trim() ||
    get("IMAGE")?.value.trim() ||
    get("ATTACH")?.value.trim() ||
    null;

  return {
    externalId: uid,
    title: oneLine(unescapeText(summary), 160) ?? "Untitled",
    description: htmlToText(unescapeText(get("DESCRIPTION")?.value ?? "")),
    startsAt: startAt.date,
    endsAt: endAt?.date ?? null,
    allDay,
    location: oneLine(unescapeText(get("LOCATION")?.value ?? "")),
    url,
    imageUrl: image && /^https?:\/\//.test(image) ? unescapeText(image) : null,
  };
}

function firstHttpUrl(text: string): string | null {
  return text.match(/https?:\/\/[^\s"'<>\\]+/)?.[0] ?? null;
}
