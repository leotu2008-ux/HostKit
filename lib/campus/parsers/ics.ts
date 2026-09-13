import { parseIcsDate } from "@/lib/campus/time";
import { decodeEntities, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * iCalendar (RFC 5545) — the one format nearly every campus calendar can
 * export. Handles folded lines, TZID/UTC/all-day dates, escaped text, and the
 * vendor extras Trumba and LiveWhale add (links, images, cancellations).
 * Recurrence rules are ignored: an RRULE event contributes its first start.
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
      if (current) {
        const event = toEvent(current, opts);
        if (event) out.push(event);
      }
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
