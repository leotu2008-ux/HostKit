import { choice, noul, score } from "@typesafe-ai/sdk";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { kmBetween, rankVenues, type RankableEvent, type RankedVenue } from "@/lib/venues/rank";
import { PLACE_PROFILES } from "@/lib/venues/suitability";
import type { VenueResult } from "@/lib/venues/types";
import type { VenueRankEvent } from "@/lib/ai/venue-rank";
import {
  decide,
  jevEnabled,
  logDecision,
  picked,
  scored,
  summarize,
  yesNo,
  type DecideOptions,
  type NoulBand,
} from "@/lib/ai/decide";

/**
 * Venue fit, decided by Jev and ranked by code.
 *
 * Code goes first with what it can know for certain. A maps result carries no
 * capacity, price or availability, so distance is the only hard filter there
 * is; everything past it is judgment. For each place left, Jev answers three
 * questions at once: does it rent out a private space, what kind of place is
 * it, and how well does it suit this night. Code then ranks on those answers,
 * falling back to rankVenues' score, and writes each venue's reason from the
 * answers alone, so the reason can't say anything Jev wasn't asked.
 *
 * A venue Jev is confident doesn't suit the night (the wrong kind of place
 * for it, a fit of "a stretch" or worse, or no private space when the night
 * needs one) is taken off the list. A venue Jev wasn't sure about stays on it,
 * tagged "worth a look". When Jev takes everything off, the list is empty:
 * the caller says nothing suitable turned up, and never falls back to the
 * unfiltered ranking.
 * `null` means the point is off or Jev answered nothing at all, and the caller
 * ranks the way it did before (lib/ai/venue-rank.ts).
 */

/** Past this from the event's centre, a place is too far to be the venue. */
export const VENUE_MAX_KM = 40;
/** Jev judges this many of the closest, best-contactable candidates. */
export const VENUE_JUDGE_LIMIT = 8;
/** How many ranked venues come back, matching rankVenues' default. */
const RESULT_LIMIT = 6;

export const PRIVATE_BAND: NoulBand = { yesAt: 0.7, noAt: 0.3 };
export const SPACE_MIN_CONFIDENCE = 0.6;
export const FIT_MIN_CONFIDENCE = 0.55;
/** A confident fit at or below this ("Wrong kind of place", "A stretch")
 *  takes a venue off the list. */
export const FIT_VETO_AT = 1;

export const SPACE_KINDS = {
  bar: "A bar, pub, lounge or brewery",
  restaurant: "A restaurant, including one with a private dining room",
  hall: "An event space, banquet hall, ballroom or function room",
  meeting: "A meeting or conference room, coworking space or office",
  cafe: "A cafe, coffee shop or bakery",
  outdoor: "A park, rooftop, garden or other outdoor space",
  other: "Something else, or not a venue at all",
} as const;
export type SpaceKind = keyof typeof SPACE_KINDS;

const SPACE_WORDS: Record<SpaceKind, string | null> = {
  bar: "Bar",
  restaurant: "Restaurant",
  hall: "Event space",
  meeting: "Meeting space",
  cafe: "Cafe",
  outdoor: "Outdoor space",
  other: null,
};

export const VENUE_QUESTIONS = {
  rentsPrivate: noul("The venue rents out a private or bookable space where a group can hold its own event.", {
    true: "Yes for an event space, banquet hall, function room, private dining room, a bar or restaurant with a room or buyout for groups, or a meeting venue.",
    false: "No for a place you can only walk into (a shop, a small counter-service cafe), or something that isn't a venue.",
  }),
  spaceKind: choice("What kind of place is the venue?", SPACE_KINDS),
  fit: score("How well would the venue suit the host's event, given its kind and its size?", [
    "Wrong kind of place for this event",
    "A stretch: possible, but not a natural fit",
    "Workable",
    "A good fit",
    "An ideal fit",
  ]),
};

/** A headcount as a band Jev can read as words; code keeps the number. */
export function sizeBand(guestCount: number): string {
  if (guestCount < 20) return "a small group, under 20 people";
  if (guestCount <= 50) return "20 to 50 people";
  if (guestCount <= 100) return "50 to 100 people";
  if (guestCount <= 250) return "100 to 250 people";
  return "a large crowd, over 250 people";
}

/** Public facts about the place, the night's kind and size, and the host's
 *  own words for the night when they gave any. No budget, no guests, no host
 *  details, no address beyond the venue's own. */
export function stateForVenue(venue: VenueResult, event: Pick<VenueRankEvent, "type" | "guestCount" | "kind">) {
  const hostWords = event.kind?.trim() ?? "";
  return {
    venue: { name: venue.name, category: venue.category ?? "unknown", address: venue.address },
    event: {
      kind: EVENT_TYPE_LABEL[event.type],
      size: sizeBand(event.guestCount),
      ...(hostWords ? { hostWords } : {}),
    },
  };
}

type Judged = {
  venue: RankedVenue;
  tier: number;
  fit: number;
  worthALook: boolean;
};

function reasonFrom(rentsPrivate: string, space: SpaceKind | "unsure", fallback: string, worthALook: boolean): string {
  const parts = [
    rentsPrivate === "yes" ? "Rents private space" : null,
    space !== "unsure" ? SPACE_WORDS[space] : null,
  ].filter((part): part is string => part !== null);
  const reason = parts.length > 0 ? parts.join(" · ") : fallback;
  return worthALook ? `Worth a look · ${reason}` : reason;
}

export async function judgeVenues(
  candidates: VenueResult[],
  event: VenueRankEvent,
  opts: DecideOptions & { eventId?: string } = {},
): Promise<{ venues: RankedVenue[]; worthALook: Set<string> } | null> {
  if (!jevEnabled("venue", opts.env)) return null;

  const rankEvent: RankableEvent = {
    type: event.type,
    guestCount: event.guestCount,
    date: event.date,
    lat: event.lat,
    lng: event.lng,
  };
  const profile = PLACE_PROFILES[event.type];

  // Code's own filters: one row per place, and near enough to be the venue.
  const seen = new Set<string>();
  const near = candidates.filter((venue) => {
    if (seen.has(venue.id)) return false;
    seen.add(venue.id);
    return kmBetween(venue.lat, venue.lng, event.lat, event.lng) <= VENUE_MAX_KM;
  });
  if (near.length === 0) return null;

  const floor = rankVenues(near, rankEvent, near.length).slice(0, VENUE_JUDGE_LIMIT);

  const decisions = await Promise.all(
    floor.map((venue) =>
      decide("venue", stateForVenue(venue, event), VENUE_QUESTIONS, {
        budgetMs: opts.budgetMs,
        fetch: opts.fetch,
        env: opts.env,
      }),
    ),
  );

  if (decisions.every((decision) => decision === null)) {
    if (opts.eventId) {
      await logDecision(opts.eventId, {
        point: "venue",
        answers: {},
        verdict: "no answer",
        model: null,
        fellBack: true,
      });
    }
    return null;
  }

  const judged: Judged[] = [];
  const logs: Array<Promise<void>> = [];
  floor.forEach((venue, i) => {
    const decision = decisions[i];
    if (!decision) {
      judged.push({ venue: { ...venue, reason: `Worth a look · ${venue.reason}` }, tier: 1, fit: -1, worthALook: true });
      return;
    }
    const rentsPrivate = yesNo(decision.answers.rentsPrivate, PRIVATE_BAND);
    const space = picked<SpaceKind>(decision.answers.spaceKind, SPACE_MIN_CONFIDENCE);
    const fit = scored(decision.answers.fit, FIT_MIN_CONFIDENCE);
    const worthALook = rentsPrivate === "unsure" || fit === "unsure";
    // Only a confident answer takes a venue off the list; an unsure one keeps
    // it, tagged worth a look.
    const vetoed =
      (rentsPrivate === "no" && profile.needsPrivateSpace) ||
      (space !== "unsure" && !profile.spaceKinds.includes(space)) ||
      (fit !== "unsure" && fit <= FIT_VETO_AT);

    if (!vetoed) {
      judged.push({
        venue: { ...venue, reason: reasonFrom(rentsPrivate, space, venue.reason, worthALook) },
        tier: rentsPrivate === "yes" ? 0 : rentsPrivate === "unsure" ? 1 : 2,
        fit: fit === "unsure" ? -1 : fit,
        worthALook,
      });
    }
    if (opts.eventId) {
      logs.push(
        logDecision(opts.eventId, {
          point: "venue",
          subject: venue.name,
          answers: summarize(decision.answers),
          verdict: vetoed
            ? "vetoed"
            : worthALook
              ? "worth a look"
              : rentsPrivate === "yes"
                ? "rents private space"
                : "judged",
          model: decision.model,
          fellBack: false,
          ms: decision.ms,
          inputTokens: decision.inputTokens,
        }),
      );
    }
  });
  await Promise.all(logs);

  // Private space first, then the better fit, then the floor's own score.
  judged.sort((a, b) => a.tier - b.tier || b.fit - a.fit || b.venue.score - a.venue.score);
  const top = judged.slice(0, RESULT_LIMIT);
  return {
    venues: top.map((entry) => entry.venue),
    worthALook: new Set(top.filter((entry) => entry.worthALook).map((entry) => entry.venue.id)),
  };
}
