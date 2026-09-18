import { db } from "@/lib/db";

/**
 * How many will actually walk through the door.
 *
 * The number every organiser gets wrong, and the one nothing else can answer:
 * it needs both the RSVP and the scan, and HostKit is the only thing that
 * sees both. Phase 1 stopped the door overwriting the first with the second,
 * so from here every finished event leaves a row worth learning from.
 *
 * Three commitments shape what follows.
 *
 * **A range, never a point.** "48 expected" invites a host to order 48
 * dinners. "38 to 58, and we are guessing" tells them the truth, which is that
 * nobody knows yet. Certainty is the one thing this must not fake.
 *
 * **Cold start is admitted, not hidden.** With no history the show rate is a
 * published prior, the band is wide, and the basis says so out loud. As real
 * outcomes accumulate the estimate shrinks toward what this host actually
 * sees, rather than switching over at some arbitrary threshold.
 *
 * **Arithmetic a host could check.** No model, no training run — a blended
 * rate and a few multipliers. Anyone can follow it, which matters because the
 * output is used to spend money.
 */

// ---------------------------------------------------------------------------
// Priors
// ---------------------------------------------------------------------------

/**
 * Of the people who say yes, how many come. Student events are famously
 * leakier than a dinner party, and 0.7 is the middle of the range reported
 * across event-industry surveys. It is a starting point to be argued out of
 * by data, not a measurement of this app.
 */
export const PRIOR_SHOW_RATE = 0.7;

/** A "maybe" is closer to a no than a yes. */
export const MAYBE_SHOW_RATE = 0.25;

/** Silence usually stays silent, but a handful always wander in. */
export const NO_REPLY_SHOW_RATE = 0.05;

/**
 * How much history it takes to outweigh the prior. At five events the blend
 * is half-and-half, which is deliberately slow: a single unusually good or
 * bad night should not move a host's catering order very far.
 */
export const PRIOR_STRENGTH = 5;

/** A crowded campus night costs turnout. Held small because it is a guess. */
export const BUSY_NIGHT_PENALTY = 0.9;
export const BUSY_NIGHT_THRESHOLD = 12;

/** How wide the band is, relative to the estimate, by how much we know. */
const WIDTH = { low: 0.35, medium: 0.22, high: 0.12 } as const;

export type Confidence = keyof typeof WIDTH;

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** What past events at this school or club actually did. */
export type ShowHistory = {
  /** Finished events with a recorded outcome. */
  events: number;
  /** Heads that said yes across them. */
  saidYes: number;
  /** Heads that came. */
  cameThrough: number;
};

export type TurnoutInput = {
  attendingHeads: number;
  maybeHeads: number;
  noReplyHeads: number;
  /**
   * The host's planned headcount, which also caps the room.
   *
   * Heads beyond anyone on the list yet still count: a night for 60 with three
   * names on it is not a night for two people, and the intake figure stays the
   * best guide until replies overtake it — the same reasoning as
   * effectiveHeadcount in lib/guests.ts.
   */
  capacity: number;
  /** Null when the date is not set. */
  daysUntil: number | null;
  /** Competing campus events that evening (lib/campus/conflicts.ts). */
  conflicts?: number | null;
  history?: ShowHistory;
};

export type TurnoutBand = {
  low: number;
  expected: number;
  high: number;
  /** The blended rate actually used, for anyone who wants to check the sum. */
  showRate: number;
  confidence: Confidence;
  /** Plain sentences explaining where the number came from. */
  basis: string[];
};

/**
 * The prior, pulled toward what this host really sees, in proportion to how
 * much of it there is. No threshold to cross: one event nudges, twenty
 * dominate.
 */
export function blendShowRate(history?: ShowHistory, prior = PRIOR_SHOW_RATE): number {
  if (!history || history.events <= 0 || history.saidYes <= 0) return prior;
  const observed = history.cameThrough / history.saidYes;
  const weight = history.events / (history.events + PRIOR_STRENGTH);
  return prior * (1 - weight) + observed * weight;
}

/** A busy night pulls turnout down a little. */
export function conflictMultiplier(conflicts?: number | null): number {
  if (typeof conflicts !== "number" || conflicts < BUSY_NIGHT_THRESHOLD) return 1;
  return BUSY_NIGHT_PENALTY;
}

/**
 * Wider when we are guessing. Replies arriving, history accumulating and the
 * night getting closer each narrow it; none of them alone is enough.
 */
export function confidenceFor(input: TurnoutInput): Confidence {
  const known = input.attendingHeads + input.maybeHeads;
  const asked = known + input.noReplyHeads;
  const replied = asked > 0 ? known / asked : 0;
  const events = input.history?.events ?? 0;
  const close = input.daysUntil !== null && input.daysUntil <= 7;

  if (events >= 5 && replied >= 0.6 && close) return "high";
  if (events >= 2 || (replied >= 0.5 && close)) return "medium";
  return "low";
}

/** Everything above, applied. */
export function predictTurnout(input: TurnoutInput): TurnoutBand {
  const rate = blendShowRate(input.history);
  const multiplier = conflictMultiplier(input.conflicts);
  const showRate = rate * multiplier;

  // Anyone the host plans for but has not invited yet still counts, at the
  // same rate as a yes — the intake figure is their own estimate of the crowd.
  const listed = input.attendingHeads + input.maybeHeads + input.noReplyHeads;
  const unlisted = Math.max(0, input.capacity - listed);

  const raw =
    input.attendingHeads * showRate +
    input.maybeHeads * MAYBE_SHOW_RATE +
    input.noReplyHeads * NO_REPLY_SHOW_RATE +
    unlisted * showRate;

  // Nobody gets in past the capacity the host set.
  const expected = Math.min(input.capacity, Math.round(raw));
  const confidence = confidenceFor(input);
  const width = WIDTH[confidence];

  const low = Math.max(0, Math.round(expected * (1 - width)));
  const high = Math.min(input.capacity, Math.round(expected * (1 + width)));

  const basis: string[] = [];
  const events = input.history?.events ?? 0;
  if (events === 0) {
    basis.push(`No finished events yet, so this uses a ${Math.round(PRIOR_SHOW_RATE * 100)}% show rate as a starting point.`);
  } else {
    basis.push(
      `Based on ${events} finished ${events === 1 ? "event" : "events"}, where ${Math.round(
        ((input.history?.cameThrough ?? 0) / Math.max(1, input.history?.saidYes ?? 1)) * 100,
      )}% of the yeses turned up.`,
    );
  }
  if (unlisted > 0) {
    basis.push(
      `${unlisted} of your ${input.capacity} are still to be invited, so this leans on your intake figure.`,
    );
  }
  if (input.attendingHeads > 0) {
    basis.push(`${input.attendingHeads} said yes.`);
  }
  if (input.noReplyHeads > 0) {
    basis.push(`${input.noReplyHeads} have not replied.`);
  }
  if (multiplier < 1) {
    basis.push(`It is a busy night on campus, which usually costs a little turnout.`);
  }
  if (expected >= input.capacity) {
    basis.push(`Capped at your capacity of ${input.capacity}.`);
  }

  return { low, expected, high, showRate, confidence, basis };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * What this host's own finished events did, falling back to their school.
 *
 * Deliberately narrow before it is broad: a club's own crowd predicts that
 * club far better than a campus average does. The school is the fallback so a
 * first-time host is not stuck with a bare prior when the campus has history.
 */
export async function showHistoryFor(opts: {
  ownerId?: string | null;
  schoolDomain?: string | null;
}): Promise<ShowHistory> {
  const own = opts.ownerId
    ? await db.eventOutcome.findMany({
        where: { event: { ownerId: opts.ownerId } },
        select: { attendingAtClose: true, checkedIn: true },
      })
    : [];

  const rows =
    own.length > 0
      ? own
      : opts.schoolDomain
        ? await db.eventOutcome.findMany({
            where: { event: { schoolDomain: opts.schoolDomain } },
            select: { attendingAtClose: true, checkedIn: true },
            take: 200,
          })
        : [];

  // Two exclusions, both learned the hard way.
  //
  // An event nobody said yes to has no denominator. And an event where nobody
  // was ever scanned is not evidence that nobody came — far more likely the
  // host never opened the door screen. Treating those as a 0% show rate
  // poisons every later estimate at that school, which is exactly what the
  // seeded demo events did the first time this ran.
  const usable = rows.filter((r) => r.attendingAtClose > 0 && r.checkedIn > 0);

  return {
    events: usable.length,
    saidYes: usable.reduce((sum, r) => sum + r.attendingAtClose, 0),
    cameThrough: usable.reduce((sum, r) => sum + r.checkedIn, 0),
  };
}
