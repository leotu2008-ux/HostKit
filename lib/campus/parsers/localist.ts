import { parseOffsetIso } from "@/lib/campus/time";
import { htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * Localist (`/api/2/events`): the platform behind MIT, BC, Northeastern, USC
 * and UT Austin's calendars. One JSON page lists events with their instances
 * in the requested window; each instance becomes its own row.
 */

type LocalistInstance = { event_instance: { id: number; start: string; end: string | null; all_day: boolean } };
type LocalistEvent = {
  event: {
    id: number;
    title: string;
    localist_url?: string;
    url?: string;
    photo_url?: string | null;
    location_name?: string | null;
    room_number?: string | null;
    description_text?: string | null;
    description?: string | null;
    event_instances?: LocalistInstance[];
    experience?: string | null;
  };
};
export type LocalistPage = { events?: LocalistEvent[]; page?: { current: number; next_page: number | null } };

export function parseLocalist(page: LocalistPage, opts: { timeZone: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const { event } of page.events ?? []) {
    if (!event?.title) continue;
    const url = event.localist_url || event.url || "";
    if (!url) continue;
    const place = [event.location_name, event.room_number].filter(Boolean).join(" · ");
    const description = event.description_text
      ? oneLine(event.description_text, 2000)
      : htmlToText(event.description);
    for (const { event_instance: inst } of event.event_instances ?? []) {
      const start = parseOffsetIso(inst.start, opts.timeZone);
      if (!start) continue;
      out.push({
        externalId: `${event.id}:${inst.id}`,
        title: oneLine(event.title, 160) ?? "Untitled",
        description,
        startsAt: start,
        endsAt: inst.end ? parseOffsetIso(inst.end, opts.timeZone) : null,
        allDay: Boolean(inst.all_day),
        location: oneLine(place) ?? (event.experience === "virtual" ? "Online" : null),
        url,
        imageUrl: event.photo_url || null,
      });
    }
  }
  return out;
}
