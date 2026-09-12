import { localDate, parseClock, parseOffsetIso } from "@/lib/campus/time";
import { absoluteUrl, decodeEntities, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * A plain HTML listing: the page is cut into items at `itemClass`, and each
 * item gives up its `<time datetime>`, its first heading (or link text), the
 * link to the event and its picture. Enough for Drupal/Craft-style school
 * sites (Wellesley, Olin) that publish no feed.
 */

export function splitItems(html: string, itemClass: string): string[] {
  const marker = new RegExp(`<([a-z0-9]+)[^>]*class="[^"]*\\b${escapeRe(itemClass)}\\b[^"]*"`, "gi");
  const starts: { at: number; tag: string }[] = [];
  for (let m = marker.exec(html); m; m = marker.exec(html)) starts.push({ at: m.index, tag: m[1].toLowerCase() });
  return starts.map(({ at, tag }, i) => {
    let end = starts[i + 1]?.at ?? Math.min(html.length, at + 12_000);
    // The last item shouldn't run into the footer: for list items and
    // articles, stop at the element's own close.
    if (tag === "li" || tag === "article") {
      const close = html.indexOf(`</${tag}>`, at);
      if (close > 0 && close < end) end = close;
    }
    return html.slice(at, end);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textOf(fragment: string): string | null {
  return oneLine(fragment, 160);
}

export type CardsOptions = {
  timeZone: string;
  pageUrl: string;
  itemClass: string;
  /**
   * For listings with no `<time>`: the class names of the month, day and
   * (optionally) year and time text inside each item. Without a year the
   * nearest upcoming one is assumed.
   */
  dateBox?: { month: string; day: string; year?: string; time?: string };
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function classText(item: string, cls: string): string | null {
  const m = item.match(new RegExp(`class="[^"]*\\b${escapeRe(cls)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i"));
  return m ? oneLine(m[1], 40) : null;
}

/** Reads a month/day(/year) date box; the year defaults to the next one that isn't past. */
export function dateFromBox(
  item: string,
  box: NonNullable<CardsOptions["dateBox"]>,
  now = new Date(),
): { startsAt: Date; endsAt: Date | null; allDay: boolean } | null {
  const month = MONTHS[(classText(item, box.month) ?? "").toLowerCase().slice(0, 3)];
  const day = Number(classText(item, box.day)?.match(/\d{1,2}/)?.[0]);
  if (!month || !day) return null;
  let year = box.year ? Number(classText(item, box.year)?.match(/\d{4}/)?.[0]) : NaN;
  if (!year) {
    year = now.getUTCFullYear();
    const candidate = Date.UTC(year, month - 1, day);
    // More than two months ago → it's next year's.
    if (candidate < now.getTime() - 60 * 86_400_000) year += 1;
  }
  const clocks = box.time
    ? [...(classText(item, box.time) ?? "").matchAll(/\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/gi)].map((m) => parseClock(m[0]))
    : [];
  const [from, to] = clocks;
  return {
    startsAt: localDate(year, month, day, from?.h ?? 0, from?.mi ?? 0),
    endsAt: to ? localDate(year, month, day, to.h, to.mi) : null,
    allDay: !from,
  };
}

/** "Thursday, September 11, 2026, 8:30 p.m." somewhere in the item's text. */
export function dateFromText(item: string): { startsAt: Date; allDay: boolean } | null {
  const text = htmlToText(item, 4000) ?? "";
  const m = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?))?/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
  const clock = m[4] ? parseClock(m[4]) : null;
  return {
    startsAt: localDate(+m[3], month, +m[2], clock?.h ?? 0, clock?.mi ?? 0),
    allDay: !clock,
  };
}

export function parseCards(html: string, opts: CardsOptions): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const item of splitItems(html, opts.itemClass)) {
    const time = item.match(/<time[^>]*datetime="([^"]+)"/i)?.[1];
    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    let boxAllDay: boolean | null = null;
    if (time) {
      startsAt = parseOffsetIso(decodeEntities(time), opts.timeZone);
    } else if (opts.dateBox) {
      const box = dateFromBox(item, opts.dateBox);
      if (box) {
        startsAt = box.startsAt;
        endsAt = box.endsAt;
        boxAllDay = box.allDay;
      }
    }
    if (!startsAt) {
      const fromText = dateFromText(item);
      if (fromText) {
        startsAt = fromText.startsAt;
        boxAllDay = fromText.allDay;
      }
    }
    if (!startsAt) continue;
    // A date-only <time> at midnight often sits next to the real hours in
    // text ("9:00 AM - 5:00 PM"); "12:00 AM - 11:59 PM" means all day.
    if (time && startsAt.getUTCHours() === 0 && startsAt.getUTCMinutes() === 0) {
      const clocks = [...item.matchAll(/\b(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)\b/gi)].map((m) => parseClock(m[1]));
      const [from, to] = clocks;
      if (from && !(from.h === 0 && from.mi === 0)) {
        const y = startsAt.getUTCFullYear(), mo = startsAt.getUTCMonth() + 1, d = startsAt.getUTCDate();
        startsAt = localDate(y, mo, d, from.h, from.mi);
        if (to) endsAt = localDate(y, mo, d, to.h, to.mi);
      }
    }

    const heading = item.match(/<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/i)?.[1];
    const headingText = heading ? textOf(heading) : null;
    const links = [...item.matchAll(/<a[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    // The event's own link: the one inside or matching the heading, else the
    // first that looks like an event page, else the first at all.
    const inHeading = heading?.match(/<a[^>]*href="([^"#]+)"/i)?.[1];
    const eventLink =
      (inHeading ? links.find((l) => l[1] === inHeading) : undefined) ??
      links.find((l) => headingText && textOf(l[2]) === headingText) ??
      links.find((l) => /\/event\//i.test(l[1])) ??
      links.find((l) => /event/i.test(l[1])) ??
      links[0];
    const title = headingText ?? textOf(eventLink?.[2] ?? "");
    const url = eventLink ? absoluteUrl(eventLink[1], opts.pageUrl) : null;
    if (!title || !url) continue;

    const image = item.match(/<img[^>]*src="([^"]+)"/i)?.[1];
    const location =
      item.match(/class="[^"]*(?:location|venue|place)[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? null;
    const copy =
      item.match(/class="[^"]*(?:copy|description|summary|teaser|body)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1] ??
      null;
    const allDay = boxAllDay ?? (startsAt.getUTCHours() === 0 && startsAt.getUTCMinutes() === 0);

    out.push({
      externalId: url,
      title,
      description: htmlToText(copy),
      startsAt,
      endsAt,
      allDay,
      location: oneLine(location),
      url,
      imageUrl: image ? absoluteUrl(image, opts.pageUrl) : null,
    });
  }
  return out;
}
