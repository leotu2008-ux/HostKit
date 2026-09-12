import { wallClock } from "@/lib/campus/time";
import { decodeEntities, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * RSS 2.0 where each item is an event and `pubDate` is the event's start
 * (Princeton's /feed/events does this). Feeds whose pubDate is the posting
 * time don't belong here — there'd be nothing to put on the calendar.
 */

function tag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
  return raw ? decodeEntities(raw) : null;
}

export function parseRss(xml: string, opts: { timeZone: string; pageUrl: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const item of xml.split(/<item(?:\s[^>]*)?>/).slice(1)) {
    const title = oneLine(tag(item, "title"), 160);
    const link = tag(item, "link") ?? tag(item, "guid");
    const when = tag(item, "pubDate") ?? tag(item, "dc:date");
    if (!title || !link || !when) continue;
    const instant = new Date(when);
    if (Number.isNaN(instant.getTime())) continue;
    out.push({
      externalId: tag(item, "guid") ?? link,
      title,
      description: htmlToText(tag(item, "content:encoded") ?? tag(item, "description")),
      startsAt: wallClock(instant, opts.timeZone),
      endsAt: null,
      allDay: false,
      location: null,
      url: link,
      imageUrl: item.match(/<(?:media:content|enclosure)[^>]*url="([^"]+)"/i)?.[1] ?? null,
      host: oneLine(tag(item, "dc:creator"), 120),
    });
  }
  return out;
}
