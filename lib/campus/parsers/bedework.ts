import { parseIcsDate } from "@/lib/campus/time";
import { htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/** Bedework's JSON feeder (Columbia's events.columbia.edu). */

type BwDate = { allday?: string; utcdate?: string; datetime?: string };
type BwEvent = {
  guid?: string;
  recurrenceId?: string;
  summary?: string;
  description?: string;
  eventlink?: string;
  link?: string;
  start?: BwDate;
  end?: BwDate;
  location?: { address?: string; link?: string };
  status?: string;
};
export type BedeworkFeed = { bwEventList?: { events?: BwEvent[] } };

export function parseBedework(feed: BedeworkFeed, opts: { timeZone: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const ev of feed.bwEventList?.events ?? []) {
    if (!ev.guid || !ev.summary || !ev.start) continue;
    if (ev.status?.toUpperCase() === "CANCELLED") continue;
    const allDay = ev.start.allday === "true";
    const start = allDay && ev.start.datetime
      ? parseIcsDate(ev.start.datetime.slice(0, 8), opts.timeZone)
      : ev.start.utcdate
        ? parseIcsDate(ev.start.utcdate, opts.timeZone)
        : null;
    if (!start) continue;
    const end = ev.end?.utcdate && !allDay ? parseIcsDate(ev.end.utcdate, opts.timeZone) : null;
    out.push({
      externalId: `${ev.guid}${ev.recurrenceId ? `:${ev.recurrenceId}` : ""}`,
      title: oneLine(ev.summary, 160) ?? "Untitled",
      description: htmlToText(ev.description),
      startsAt: start.date,
      endsAt: end?.date ?? null,
      allDay,
      location: oneLine(ev.location?.address),
      url: ev.eventlink || ev.link || "https://events.columbia.edu/",
      imageUrl: null,
    });
  }
  return out;
}
