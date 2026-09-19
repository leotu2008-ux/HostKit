import { db } from "@/lib/db";
import { dedupeAcrossSources } from "@/lib/campus/feed";

/**
 * What else is on that night.
 *
 * The single most useful thing HostKit knows and nobody else does. The synced
 * calendar holds tens of thousands of real campus events, so "is Thursday a
 * bad night at Babson" is a query, not a guess — and it is answerable before
 * a single guest has RSVP'd, which is why this ships ahead of anything that
 * needs history.
 *
 * A note on time, because the two sides do not agree and it bit once already.
 * A campus event's `startsAt` is the school's local time encoded as UTC. An
 * `Event.date` is not: lib/actions/events.ts parses "2026-09-23T20:00" in the
 * server's own zone, so the stored instant is offset from the wall clock the
 * host typed. Comparing the two raw put an 8pm social on the following day and
 * dragged in every all-day listing sitting at midnight.
 *
 * So anything arriving from an Event goes through `toWallClock` first, which
 * rebuilds the instant from its local parts. After that both sides live in the
 * same space and the rest of this file can stay in UTC.
 *
 * The pure functions here carry the rules; only the exported queries touch
 * the database.
 */

/** Evening, in school local hours. Daytime lectures don't compete with a social. */
export const NIGHT_FROM_HOUR = 17;
export const NIGHT_TO_HOUR = 24;

/** Either side of a proposed start, for "on at the same time". */
export const CLASH_WINDOW_HOURS = 3;

export type CompetingEvent = {
  id: string;
  title: string;
  startsAt: Date;
  host: string | null;
  url: string;
};

/** How crowded one night is. */
export type NightLoad = {
  /** Midnight of that night, school local time encoded as UTC. */
  night: Date;
  /** Everything on that evening. */
  count: number;
};

export type Busyness = "quiet" | "normal" | "busy";

/**
 * Thresholds from the real feed rather than taste: across 46 schools the
 * average day carries about ten events and the worst carries 147, so "busy"
 * is set where a night is clearly above the ordinary rather than merely
 * non-empty.
 */
export function busyness(count: number): Busyness {
  if (count <= 3) return "quiet";
  if (count >= 12) return "busy";
  return "normal";
}

/**
 * An `Event.date` in the same wall-clock space campus events use: same year,
 * month, day, hour and minute, reinterpreted as UTC.
 */
export function toWallClock(local: Date): Date {
  return new Date(
    Date.UTC(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
      local.getMinutes(),
    ),
  );
}

/** The span either side of a proposed start that counts as a clash. */
export function clashWindow(start: Date, hours = CLASH_WINDOW_HOURS): { from: Date; to: Date } {
  return {
    from: new Date(start.getTime() - hours * 3_600_000),
    to: new Date(start.getTime() + hours * 3_600_000),
  };
}

/** Midnight opening the evening a moment belongs to. */
export function nightOf(when: Date): Date {
  const night = new Date(when);
  night.setUTCHours(0, 0, 0, 0);
  return night;
}

/** The evening slice of a given night. */
export function eveningOf(night: Date): { from: Date; to: Date } {
  const from = new Date(night);
  from.setUTCHours(NIGHT_FROM_HOUR, 0, 0, 0);
  const to = new Date(night);
  to.setUTCHours(0, 0, 0, 0);
  return { from, to: new Date(to.getTime() + NIGHT_TO_HOUR * 3_600_000) };
}

/**
 * Quieter nights first, and among equals the soonest — a host wants the next
 * good night, not the emptiest one three weeks out.
 */
export function rankNights(loads: NightLoad[]): NightLoad[] {
  return [...loads].sort(
    (a, b) => a.count - b.count || a.night.getTime() - b.night.getTime(),
  );
}

/**
 * Nights worth moving to: clearly quieter than the one proposed, and not the
 * proposed night itself. Empty when the chosen night is already fine, because
 * nagging a host about a good decision is worse than saying nothing.
 */
export function betterNights(proposed: NightLoad, all: NightLoad[], take = 2): NightLoad[] {
  if (busyness(proposed.count) !== "busy") return [];
  return rankNights(all)
    .filter((n) => n.night.getTime() !== proposed.night.getTime() && n.count < proposed.count)
    .slice(0, take);
}

/**
 * The load recorded for one night, or an empty night when the run doesn't
 * cover it. Pulled out of adviseNight so a caller that wants only the number
 * asks the same question the panel does, rather than a second, drifting one.
 */
export function loadForNight(loads: NightLoad[], night: Date): NightLoad {
  return loads.find((l) => l.night.getTime() === night.getTime()) ?? { night, count: 0 };
}

/**
 * One line for the host, at the moment they pick a date — or nothing at all.
 *
 * Silent on a quiet or ordinary night, on purpose and for the same reason
 * NightAdvicePanel is: this fires while someone is filling in a form, and a
 * note that always appears is furniture, not advice.
 */
export function nightNote(count: number): { level: Busyness; line: string } | null {
  const level = busyness(count);
  if (level !== "busy") return null;

  return {
    level,
    line: `${count} other things are already on that evening at your school. Quieter nights are usually easier to fill.`,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Everything on at that school within a few hours of a proposed start. */
export async function competingEvents(
  schoolDomain: string | null | undefined,
  start: Date | null | undefined,
  hours = CLASH_WINDOW_HOURS,
  take = 6,
): Promise<CompetingEvent[]> {
  if (!schoolDomain || !start) return [];
  const { from, to } = clashWindow(start, hours);

  // Schools list the same event on more than one feed, so a raw query shows
  // the language table twice and reads like a stutter. The campus list already
  // solved this; reuse it rather than inventing a second rule.
  const rows = await db.campusEvent.findMany({
    // An exhibition that runs all day is not competing for 8pm.
    where: { schoolDomain, allDay: false, startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: "asc" },
    take: take * 4,
  });

  return dedupeAcrossSources(rows).slice(0, take);
}

/** How busy each evening is, across a run of nights. */
export async function nightLoads(
  schoolDomain: string | null | undefined,
  from: Date,
  days: number,
): Promise<NightLoad[]> {
  if (!schoolDomain) return [];
  const start = nightOf(from);
  const end = new Date(start.getTime() + days * 86_400_000);

  const rows = await db.campusEvent.findMany({
    where: { schoolDomain, allDay: false, startsAt: { gte: start, lt: end } },
    select: { startsAt: true },
  });

  // One bucket per night, including the empty ones — a night with nothing on
  // is the answer a host is looking for, so it has to survive the grouping.
  const counts = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    counts.set(start.getTime() + i * 86_400_000, 0);
  }
  for (const row of rows) {
    const hour = row.startsAt.getUTCHours();
    if (hour < NIGHT_FROM_HOUR) continue;
    const key = nightOf(row.startsAt).getTime();
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([ms, count]) => ({ night: new Date(ms), count }));
}

export type NightAdvice = {
  load: NightLoad;
  busyness: Busyness;
  clashes: CompetingEvent[];
  alternatives: NightLoad[];
};

/** Everything the page needs about a proposed night, in one round trip. */
export async function adviseNight(
  schoolDomain: string | null | undefined,
  start: Date | null | undefined,
  lookAheadDays = 14,
): Promise<NightAdvice | null> {
  if (!schoolDomain || !start) return null;

  // The one place the two time conventions meet.
  const when = toWallClock(start);

  const [clashes, loads] = await Promise.all([
    competingEvents(schoolDomain, when),
    nightLoads(schoolDomain, when, lookAheadDays),
  ]);

  const night = nightOf(when);
  const load = loadForNight(loads, night);

  return {
    load,
    busyness: busyness(load.count),
    clashes,
    alternatives: betterNights(load, loads),
  };
}

/**
 * How many other things are on the evening of `start` — the number alone, for
 * callers that do not need the panel's clashes and alternatives.
 *
 * One night, so one query. Null when there is no school or no date, which
 * predictTurnout reads as "ordinary night".
 */
export async function conflictCountFor(
  schoolDomain: string | null | undefined,
  start: Date | null | undefined,
): Promise<number | null> {
  if (!schoolDomain || !start) return null;

  // Same crossing of the two time conventions adviseNight makes.
  const when = toWallClock(start);
  const loads = await nightLoads(schoolDomain, when, 1);

  return loadForNight(loads, nightOf(when)).count;
}
