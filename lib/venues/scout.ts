import type { EventType } from "@/generated/prisma/enums";
import type { City } from "@/lib/catalog";
import { VENUE_MAX_KM } from "@/lib/ai/venue-judge";
import { venueQueryFor } from "@/lib/venues/query";
import { kmBetween } from "@/lib/venues/rank";
import { searchVenues } from "@/lib/venues/search";
import { FREE_SOURCES, PLACE_PROFILES, freeSourceFor, placeFit, type FreeSource } from "@/lib/venues/suitability";
import type { VenueResult } from "@/lib/venues/types";

/**
 * The venue scan behind the agent's venue step and the host's "Find venues".
 *
 * One search word was the whole scan before ("bar" for a mixer, 12 results).
 * Now: the base query with the host's vibe, the night's own searches and its
 * free sources' searches, at most five, in parallel. Places whose type rules
 * them out are dropped here, before Jev or the ranker sees them; free rooms
 * are set aside, because Hosty offers one of them on top of the paid list
 * rather than ranking it against bars.
 */

export type FreeVenue = VenueResult & { freeSource: FreeSource };

export type ScoutEvent = { type: EventType; guestCount: number; vibe: string | null; city: City };

type Search = (query: string, city: City) => Promise<VenueResult[]>;

export function scoutQueries(event: ScoutEvent): string[] {
  const profile = PLACE_PROFILES[event.type];
  return [
    ...new Set([
      venueQueryFor({ type: event.type, guestCount: event.guestCount, vibe: event.vibe }),
      ...profile.searches,
      ...profile.freeSources.map((source) => FREE_SOURCES[source].search),
    ]),
  ];
}

export async function scoutVenues(
  event: ScoutEvent,
  search: Search = searchVenues,
): Promise<{ suitable: VenueResult[]; free: FreeVenue[] }> {
  const settled = await Promise.allSettled(scoutQueries(event).map((query) => search(query, event.city)));
  const answered = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (answered.length === 0) {
    // Every search failed: surface the first failure, as one search did.
    const first = settled[0];
    throw first?.status === "rejected" ? first.reason : new Error("Venue search isn't answering");
  }

  const seen = new Set<string>();
  const suitable: VenueResult[] = [];
  const free: FreeVenue[] = [];
  for (const venue of answered.flat()) {
    if (seen.has(venue.id)) continue;
    seen.add(venue.id);
    const source = freeSourceFor(venue, event.type);
    if (source) free.push({ ...venue, freeSource: source });
    else if (placeFit(venue, event.type) !== "no") suitable.push(venue);
  }
  return { suitable, free };
}

/** The free room closest to the event, if one is near enough to be the venue. */
export function closestFree(free: FreeVenue[], at: { lat: number; lng: number }): FreeVenue | null {
  let best: { venue: FreeVenue; km: number } | null = null;
  for (const venue of free) {
    const km = kmBetween(venue.lat, venue.lng, at.lat, at.lng);
    if (km > VENUE_MAX_KM) continue;
    if (!best || km < best.km) best = { venue, km };
  }
  return best?.venue ?? null;
}
