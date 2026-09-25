import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { askOr } from "@/lib/ai/client";
import { checkDraft } from "@/lib/ai/guardrail";
import { judgeVenues, VENUE_MAX_KM } from "@/lib/ai/venue-judge";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { kmBetween, rankVenues, type RankableEvent, type RankedVenue } from "@/lib/venues/rank";
import { formatDuration } from "@/lib/when";
import type { VenueResult } from "@/lib/venues/apple-maps";

/**
 * AI touchpoint #1: judgement layered on top of rankVenues' deterministic
 * score. The model only reorders and explains a fixed list of real
 * candidates — see the four rules in lib/ai/client.ts — so everything it
 * could get wrong (a wrong id, a repeated one, too few picks) is repaired in
 * code after the schema passes, never trusted from the answer itself.
 */

const pickSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(3).max(140),
});

const rankSchema = z.object({
  picks: z.array(pickSchema).min(1).max(6),
});

type RankAnswer = z.infer<typeof rankSchema>;

/** The minimum a host should see regardless of how few picks the model made.
 *  rankVenues has no floor of its own (its default is limit = 6, a ceiling);
 *  3 is this module's own judgment call about a usable minimum. */
const MIN_PICKS = 3;

export type VenueRankEvent = {
  type: EventType;
  city: string;
  guestCount: number;
  durationHours: number;
  date: Date | null;
  vibe?: string | null;
  /** The host's own words for the kind of night ("founders networking
   *  night"). Jev's venue point reads it; nothing else here does. */
  kind?: string | null;
  lat: number;
  lng: number;
  /** VENUE category allocation, in cents; null when nothing is allocated. */
  venueAllocatedCents: number | null;
};

export type VenueRankOptions = {
  now?: Date;
  /** Injectable for tests; forwarded to askOr, defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** The event the reasons are for, so the guardrail can log its checks. */
  eventId?: string;
  /** Injectable for tests: the guardrail's fetch and environment. */
  jev?: { fetch?: typeof fetch; env?: Record<string, string | undefined> };
};

function systemPrompt(): string {
  return [
    "You rank venue candidates for a Hosty event from a fixed list the caller gives you.",
    "Pick between 1 and 6 candidates, best first, using only the ids you are given — copy them exactly. Never invent a venue, a phone number, a website, a capacity or a price; everything about a candidate beyond its id and name may be wrong or missing, and that is fine to say.",
    "Give each pick one short reason, 3 to 140 characters, grounded only in what you were told.",
    "Return JSON only, matching the schema you are given.",
  ].join("\n");
}

function candidateLine(venue: VenueResult): string {
  return [
    venue.id,
    venue.name,
    venue.category ?? "unknown",
    venue.address,
    venue.phone ? "y" : "n",
    venue.website ? "y" : "n",
  ].join(" | ");
}

function userPrompt(candidates: VenueResult[], event: VenueRankEvent, now: Date): string {
  const lines: Array<string | null> = [
    `Event type: ${EVENT_TYPE_LABEL[event.type]}`,
    `City: ${event.city}`,
    `Guest count: ${event.guestCount}`,
    `Duration: ${formatDuration(event.durationHours)}`,
    `When: ${describeCountdown(daysUntil(event.date, now))}`,
    event.vibe ? `Vibe: ${event.vibe}` : null,
    event.venueAllocatedCents !== null
      ? `Venue budget: $${Math.round(event.venueAllocatedCents / 100)}`
      : null,
    "Candidates (id | name | category | address | phone y/n | site y/n):",
    ...candidates.map(candidateLine),
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/** Never used: askOr's fallback callback must return an answer of the right
 *  shape, but rankVenuesForEvent discards it on a fallback and calls
 *  rankVenues directly instead of routing a manufactured answer back through
 *  the reconciliation path. Mirrors lib/ai/plan-draft.ts's unusedFallback. */
function unusedFallback(): RankAnswer {
  return { picks: [] };
}

/**
 * Turns a validated-but-not-yet-trusted model answer into RankedVenue[]: drop
 * any id that isn't a real candidate, dedupe a repeated one, then top up from
 * the deterministic ranking until there are at least MIN_PICKS — carrying
 * that ranking's own score rather than inventing one for the model's picks.
 */
function reconcile(
  answer: RankAnswer,
  candidates: VenueResult[],
  event: RankableEvent,
): RankedVenue[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const deterministic = rankVenues(candidates, event, candidates.length);
  const scoreById = new Map(deterministic.map((v) => [v.id, v.score]));

  const seen = new Set<string>();
  const picked: RankedVenue[] = [];
  for (const pick of answer.picks) {
    if (seen.has(pick.id)) continue;
    const venue = byId.get(pick.id);
    if (!venue) continue;
    seen.add(pick.id);
    picked.push({ ...venue, score: scoreById.get(pick.id) ?? 0, reason: pick.reason });
  }

  for (const fallback of deterministic) {
    if (picked.length >= MIN_PICKS) break;
    if (seen.has(fallback.id)) continue;
    seen.add(fallback.id);
    picked.push(fallback);
  }

  return picked;
}

export async function rankVenuesForEvent(
  candidates: VenueResult[],
  event: VenueRankEvent,
  opts: VenueRankOptions = {},
): Promise<{
  venues: RankedVenue[];
  source: "jev" | "model" | "fallback";
  /** Ids Jev wasn't sure about (source "jev" only): kept, and worth a look. */
  worthALook?: Set<string>;
}> {
  const now = opts.now ?? new Date();
  const rankEvent: RankableEvent = {
    type: event.type,
    guestCount: event.guestCount,
    date: event.date,
    lat: event.lat,
    lng: event.lng,
  };

  // The same 40 km cutoff judgeVenues applies for the Jev path, applied here
  // so the model and fallback paths can't rank — or the free room's own
  // closestFree beat — a venue too far away to be the one.
  const near = candidates.filter((venue) => kmBetween(venue.lat, venue.lng, event.lat, event.lng) <= VENUE_MAX_KM);

  if (near.length === 0) {
    return { venues: [], source: "fallback" };
  }

  // Jev decides fit when that point is on (lib/ai/venue-judge.ts); with it
  // off or silent, everything below runs exactly as it did before.
  const judged = await judgeVenues(near, event, {
    eventId: opts.eventId,
    fetch: opts.jev?.fetch,
    env: opts.jev?.env,
  });
  if (judged) return { venues: judged.venues, source: "jev", worthALook: judged.worthALook };

  const { value, source } = await askOr(
    {
      system: systemPrompt(),
      prompt: userPrompt(near, event, now),
      schema: rankSchema,
      fetchImpl: opts.fetchImpl,
      timeoutMs: 8000,
      maxTokens: 700,
    },
    unusedFallback,
  );

  if (source === "fallback") {
    return { venues: rankVenues(near, rankEvent), source: "fallback" };
  }

  const picked = reconcile(value, near, rankEvent);
  return { venues: await guardReasons(picked, value, near, rankEvent, event, now, opts), source: "model" };
}

/**
 * The guardrail over the model's reasons (lib/ai/guardrail.ts): a reason that
 * hints at the budget or states a value the record doesn't hold is swapped for
 * the deterministic reason for that venue. No second try: a reason is a short
 * note and the replacement is exact. With the guardrail off, nothing changes.
 */
async function guardReasons(
  picked: RankedVenue[],
  answer: RankAnswer,
  candidates: VenueResult[],
  rankEvent: RankableEvent,
  event: VenueRankEvent,
  now: Date,
  opts: VenueRankOptions,
): Promise<RankedVenue[]> {
  const modelWrote = new Set(answer.picks.map((pick) => pick.id));
  const plain = new Map(rankVenues(candidates, rankEvent, candidates.length).map((v) => [v.id, v.reason]));
  const days = daysUntil(event.date, now);
  const duration = formatDuration(event.durationHours);
  const allowedNumbers = [event.guestCount, event.durationHours, ...(days === null ? [] : [days])];
  const digitsIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

  return Promise.all(
    picked.map(async (venue) => {
      if (!modelWrote.has(venue.id)) return venue;
      const check = await checkDraft(venue.reason, {
        eventId: opts.eventId,
        subject: `venue reason: ${venue.name}`,
        allowedNumbers: [...allowedNumbers, ...digitsIn(`${duration} ${venue.name} ${venue.address}`)],
        allowedPhrases: [describeCountdown(days), duration, venue.name, venue.address],
        fetch: opts.jev?.fetch,
        env: opts.jev?.env,
      });
      if (!check || check.verdict === "pass") return venue;
      return { ...venue, reason: plain.get(venue.id) ?? venue.reason };
    }),
  );
}
