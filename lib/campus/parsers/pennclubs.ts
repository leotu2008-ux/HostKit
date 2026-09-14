import { parseOffsetIso } from "@/lib/campus/time";
import { htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * Penn Clubs (`pennclubs.com/api/events/`) — the student-activities
 * directory Penn runs itself, and the only public event feed the
 * university has: `events.upenn.edu` and `calendar.upenn.edu` do not
 * resolve at all.
 *
 * A flat list of events, each with one or more `showings`. A showing is an
 * occurrence with its own start, end and room, so each becomes its own row
 * — the same shape Localist's `event_instances` produce. The list is an
 * archive going back to 2001; `selectUpcoming` trims it to the window.
 */

export type PennClubsEvent = {
  id: number;
  name?: string | null;
  description?: string | null;
  url?: string | null;
  image_url?: string | null;
  large_image_url?: string | null;
  club?: string | null;
  club_name?: string | null;
  showings?: {
    id: number;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    location_visible_to_public?: boolean | null;
  }[];
};

export function parsePennClubs(
  events: PennClubsEvent[],
  opts: { timeZone: string; pageUrl: string },
): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const event of events) {
    const title = oneLine(event.name, 160);
    if (!title) continue;

    const description = htmlToText(event.description ?? null);
    const image = event.large_image_url ?? event.image_url ?? null;
    // The club's own page is the only stable link; `url` is an optional
    // external one the club typed in, so prefer it when it is a real link.
    const link =
      event.url && /^https?:\/\//.test(event.url)
        ? event.url
        : event.club
          ? `https://pennclubs.com/club/${event.club}`
          : opts.pageUrl;

    for (const showing of event.showings ?? []) {
      if (!showing.start_time) continue;
      const startsAt = parseOffsetIso(showing.start_time, opts.timeZone);
      if (!startsAt) continue;
      const endsAt = showing.end_time ? parseOffsetIso(showing.end_time, opts.timeZone) : null;

      out.push({
        externalId: `${event.id}:${showing.id}`,
        title,
        description,
        startsAt,
        endsAt,
        allDay: false,
        location: oneLine(showing.location ?? null),
        url: link,
        imageUrl: image && /^https?:\/\//.test(image) ? image : null,
        host: oneLine(event.club_name, 120),
        // Penn lets a club keep the room to members; the rest is public.
        restricted: showing.location_visible_to_public === false,
      });
    }
  }
  return out;
}
