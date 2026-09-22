/**
 * What a duration is allowed to be, in one place.
 *
 * An event's length is fractional hours in quarter-hour steps
 * (prisma/schema.prisma `durationHours`), and three callers have to agree on
 * exactly the same arithmetic: the duration wheel that sets it
 * (components/duration-wheel.tsx), the brief action that saves what the wheel
 * submitted (lib/actions/brief.ts), and the iOS create route, which is a
 * client the wheel's rules can't reach (app/api/v1/events/route.ts). Kept pure
 * so the rules are tested once rather than trusted three times.
 *
 * Formatting a duration for a reader is lib/when.ts's job, not this file's.
 */

/** A quarter hour is the smallest thing worth calling a duration. */
export const MIN_DURATION_HOURS = 0.25;
/** Past a day it isn't a night. */
export const MAX_DURATION_HOURS = 24;
/** What a blank event opens on, and the answer to nonsense. */
export const DEFAULT_DURATION_HOURS = 4;

/** The only minutes a duration can carry — one row each on the wheel. */
export const MINUTE_STEPS = [0, 15, 30, 45] as const;
export type DurationMinutes = (typeof MINUTE_STEPS)[number];

const QUARTERS_PER_HOUR = 4;
const MIN_QUARTERS = MIN_DURATION_HOURS * QUARTERS_PER_HOUR;
const MAX_QUARTERS = MAX_DURATION_HOURS * QUARTERS_PER_HOUR;

/** Fractional hours to the nearest quarter, held inside the range. Anything
 *  that isn't a number at all — a NaN out of a coercion, a corrupt row — is
 *  the default rather than a throw, since every caller is showing a host a
 *  form and none of them can usefully fail. */
export function snapQuarterHours(hours: number): number {
  if (!Number.isFinite(hours)) return DEFAULT_DURATION_HOURS;
  const quarters = Math.round(hours * QUARTERS_PER_HOUR);
  return Math.min(MAX_QUARTERS, Math.max(MIN_QUARTERS, quarters)) / QUARTERS_PER_HOUR;
}

/** Decimal hours to the two drum positions, snapped on the way so a stored
 *  oddity still lands on a row the wheel has. */
export function splitHours(hours: number): { h: number; m: DurationMinutes } {
  const quarters = Math.round(snapQuarterHours(hours) * QUARTERS_PER_HOUR);
  return {
    h: Math.floor(quarters / QUARTERS_PER_HOUR),
    m: MINUTE_STEPS[quarters % QUARTERS_PER_HOUR],
  };
}

/** The two drum positions back to the decimal hours the column stores. Exact:
 *  15, 30 and 45 minutes are all exact binary fractions of an hour, so this is
 *  1.5 and not 1.4999999999999998. */
export function joinHours(h: number, m: DurationMinutes): number {
  return h + m / 60;
}

/** The two ends of the range rule each other out: a full day has no minutes
 *  left to add, and no hours at all still has to last a quarter of one. Both
 *  drums stay their full length — see `ruledOutMinutes` for the rows that go
 *  dim — so this is what a position means once the other drum has spoken. */
export function applyDurationRules(
  h: number,
  m: DurationMinutes,
): { h: number; m: DurationMinutes } {
  if (h >= MAX_DURATION_HOURS) return { h: MAX_DURATION_HOURS, m: 0 };
  if (h === 0 && m === 0) return { h: 0, m: MINUTE_STEPS[1] };
  return { h, m };
}

/** The minute rows `applyDurationRules` would refuse at this hour, for the
 *  wheel to dim. The same rule read the other way round. */
export function ruledOutMinutes(h: number): DurationMinutes[] {
  return MINUTE_STEPS.filter((m) => applyDurationRules(h, m).m !== m);
}

/** The exact decimal string the hidden form field submits — "1.5", "0.25",
 *  "4". Snapped, so nothing off the step can reach the action. */
export function hoursToInputValue(hours: number): string {
  return String(snapQuarterHours(hours));
}
