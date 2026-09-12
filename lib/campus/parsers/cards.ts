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

export function parseCards(
  html: string,
  opts: { timeZone: string; pageUrl: string; itemClass: string },
): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const item of splitItems(html, opts.itemClass)) {
    const time = item.match(/<time[^>]*datetime="([^"]+)"/i)?.[1];
    if (!time) continue;
    let startsAt = parseOffsetIso(decodeEntities(time), opts.timeZone);
    if (!startsAt) continue;
    let endsAt: Date | null = null;
    // A date-only <time> at midnight often sits next to the real hours in
    // text ("9:00 AM - 5:00 PM"); "12:00 AM - 11:59 PM" means all day.
    if (startsAt.getUTCHours() === 0 && startsAt.getUTCMinutes() === 0) {
      const clocks = [...item.matchAll(/\b(\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?)\b/gi)].map((m) => parseClock(m[1]));
      const [from, to] = clocks;
      if (from && !(from.h === 0 && from.mi === 0)) {
        const y = startsAt.getUTCFullYear(), mo = startsAt.getUTCMonth() + 1, d = startsAt.getUTCDate();
        startsAt = localDate(y, mo, d, from.h, from.mi);
        if (to) endsAt = localDate(y, mo, d, to.h, to.mi);
      }
    }

    const heading = item.match(/<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/i)?.[1];
    const links = [...item.matchAll(/<a[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    // The event's own link: the one wrapping the heading, else the first that
    // looks like an event page, else the first at all.
    const eventLink =
      links.find((l) => heading && l[2].includes(heading.trim().slice(0, 20))) ??
      links.find((l) => /event/i.test(l[1])) ??
      links[0];
    const title = textOf(heading ?? eventLink?.[2] ?? "");
    const url = eventLink ? absoluteUrl(eventLink[1], opts.pageUrl) : null;
    if (!title || !url) continue;

    const image = item.match(/<img[^>]*src="([^"]+)"/i)?.[1];
    const location =
      item.match(/class="[^"]*(?:location|venue|place)[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? null;
    const copy =
      item.match(/class="[^"]*(?:copy|description|summary|teaser|body)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1] ??
      null;
    const allDay = startsAt.getUTCHours() === 0 && startsAt.getUTCMinutes() === 0;

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
