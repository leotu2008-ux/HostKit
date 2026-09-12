import { localDate, parseClock } from "@/lib/campus/time";
import { absoluteUrl, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * babson.edu/about/events: no feed, so this reads the page itself. Each
 * `event-item` has a date box (month / day / year, optionally a second box
 * for a range), a title, clock times, and a "Find out more" or "Register"
 * link. Times are Babson's wall clock (Eastern), which is what we store.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function dateBox(fragment: string): { y: number; m: number; d: number } | null {
  const month = fragment.match(/class="month">\s*([A-Za-z]+)/)?.[1];
  const day = fragment.match(/class="day">\s*(\d{1,2})/)?.[1];
  const year = fragment.match(/class="year">\s*(\d{4})/)?.[1];
  const m = month ? MONTHS[month.toLowerCase().slice(0, 4)] ?? MONTHS[month.toLowerCase().slice(0, 3)] : undefined;
  if (!m || !day || !year) return null;
  return { y: +year, m, d: +day };
}

export function parseBabson(html: string, opts: { pageUrl: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  const items = html.split(/<li[^>]*class="[^"]*\bevent-item\b[^"]*"/i).slice(1);
  for (const item of items) {
    const title = oneLine(item.match(/class="title"[^>]*>([\s\S]*?)<\/p>/i)?.[1], 160);
    if (!title) continue;
    const boxes = item.split(/class="date-stamp/).slice(1);
    const start = dateBox(boxes[0] ?? "");
    if (!start) continue;
    const end = boxes.length > 2 ? dateBox(boxes[boxes.length - 1]) : null;
    const clocks = [...item.matchAll(/class="datelisting">\s*([^<]+)</g)].map((m) => parseClock(m[1]));
    const startClock = clocks[0] ?? null;
    const endClock = clocks[1] ?? null;

    const link =
      item.match(/<a[^>]*class="find-out-more"[^>]*href="([^"]+)"/i)?.[1] ??
      item.match(/<a[^>]*href="([^"]+)"[^>]*class="find-out-more"/i)?.[1] ??
      item.match(/<a[^>]*href="([^"]+)"[^>]*title="Register/i)?.[1] ??
      item.match(/<a[^>]*href="([^"]+)"/i)?.[1] ??
      null;
    const url = (link && absoluteUrl(link, opts.pageUrl)) ?? opts.pageUrl;
    const blurb = item.match(/<div class="image">([\s\S]*?)<a /i)?.[1] ?? null;
    const location = item.match(/fa-map-marker[^<]*<\/span>\s*([^<]+)/i)?.[1] ?? null;

    const startsAt = localDate(start.y, start.m, start.d, startClock?.h ?? 0, startClock?.mi ?? 0);
    const endDay = end ?? start;
    const endsAt = endClock ? localDate(endDay.y, endDay.m, endDay.d, endClock.h, endClock.mi) : null;

    out.push({
      externalId: `${start.y}${String(start.m).padStart(2, "0")}${String(start.d).padStart(2, "0")}:${title}`,
      title,
      description: htmlToText(blurb),
      startsAt,
      endsAt,
      allDay: !startClock,
      location: oneLine(location),
      url,
      imageUrl: null,
    });
  }
  return out;
}
