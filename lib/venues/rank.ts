import type { EventType } from "@/generated/prisma/enums";
import type { VenueResult } from "@/lib/venues/apple-maps";

/**
 * Scoring an Apple Maps result against ONE specific event — the floor under
 * lib/ai/venue-rank.ts, same shape as lib/scoring.ts's scoreListing. Every
 * candidate starts as a perfect fit and loses points for each way it falls
 * short, so the scale stays meaningful: 100 means "nothing wrong with this,"
 * not "scored well on a curve."
 */

export type RankedVenue = VenueResult & {
  score: number;
  reason: string;
};

export type RankableEvent = {
  type: EventType;
  guestCount: number;
  date: Date | null;
  lat: number;
  lng: number;
};

const NO_CONTACT_PENALTY = 45;
const NO_PHONE_PENALTY = 20;
const NO_WEBSITE_PENALTY = 10;
const CATEGORY_MISMATCH_PENALTY = 15;
const DISTANCE_FREE_KM = 8;
const DISTANCE_MAX_PENALTY = 25;
const EARTH_RADIUS_KM = 6371;

/**
 * A loose keyword per event type, used only to catch an obvious mismatch.
 * Apple's POI taxonomy isn't documented, so this is deliberately forgiving:
 * no category at all, or any textual overlap, both count as a match. Only a
 * clear disagreement — neither term appears in the other — costs points.
 */
const CATEGORY_KEYWORD: Record<EventType, string> = {
  BIRTHDAY: "party",
  CORPORATE_OFFSITE: "meeting",
  LAUNCH_PARTY: "event",
  DINNER_PARTY: "restaurant",
  FUNDRAISER: "banquet",
  MIXER: "bar",
  GENERAL_MEETING: "meeting",
  FORMAL: "banquet",
  PITCH_NIGHT: "event",
  STUDY_BREAK: "cafe",
};

function categoryMatches(category: string | null, type: EventType): boolean {
  if (!category) return true;
  const keyword = CATEGORY_KEYWORD[type];
  const lower = category.toLowerCase();
  return lower.includes(keyword) || keyword.includes(lower);
}

/** Great-circle distance in kilometers, mirroring catalog.ts's milesBetween
 *  but in the unit the distance penalty is specified in. */
function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 0 within the free radius; beyond it, 1 point per kilometer over, floored
 *  at a 25-point ceiling so a venue three states away doesn't score negative
 *  on distance alone. */
function distancePenalty(distanceKm: number): number {
  if (distanceKm <= DISTANCE_FREE_KM) return 0;
  return -Math.min(DISTANCE_MAX_PENALTY, Math.floor(distanceKm - DISTANCE_FREE_KM));
}

function reasonFor(hasPhone: boolean, hasWebsite: boolean): string {
  if (hasPhone && hasWebsite) return "Has a phone number and a site";
  if (hasPhone) return "Has a phone number";
  if (hasWebsite) return "Has a site";
  return "No phone or site listed";
}

/** Deterministic ranking — the floor lib/ai/venue-rank.ts falls back to (and
 *  tops up from) when the model is absent or its answer can't be trusted. */
export function rankVenues(
  candidates: VenueResult[],
  event: RankableEvent,
  limit = 6,
): RankedVenue[] {
  const scored = candidates.map((venue) => {
    const hasPhone = Boolean(venue.phone);
    const hasWebsite = Boolean(venue.website);

    let score = 100;
    if (!hasPhone && !hasWebsite) score -= NO_CONTACT_PENALTY;
    else if (!hasPhone) score -= NO_PHONE_PENALTY;
    else if (!hasWebsite) score -= NO_WEBSITE_PENALTY;

    if (!categoryMatches(venue.category, event.type)) score -= CATEGORY_MISMATCH_PENALTY;

    score += distancePenalty(kmBetween(venue.lat, venue.lng, event.lat, event.lng));

    return {
      ...venue,
      score: Math.round(Math.max(0, Math.min(100, score))),
      reason: reasonFor(hasPhone, hasWebsite),
    };
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}
