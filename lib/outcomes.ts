import { db } from "@/lib/db";
import { effectiveHeadcount, summarizeGuests } from "@/lib/guests";

/**
 * Freezing what actually happened.
 *
 * Every headcount in this app is recomputed on request and thrown away, so
 * nothing survives the night. That is fine for a page and useless for
 * learning: you cannot tell whether the estimate was any good, and you cannot
 * get better at guessing next time.
 *
 * So when an event finishes, one row is written and never touched again —
 * what we expected against what came through the door. It is a small table on
 * purpose. The value is that it is honest and immutable, not that it is rich.
 */

/** An event is done once its last hour has passed, with a little slack. */
const GRACE_MS = 2 * 60 * 60_000;

export type OutcomeCounts = {
  expectedHeads: number;
  attendingAtClose: number;
  checkedIn: number;
  walkUps: number;
  capacity: number;
};

type GuestRow = {
  rsvpStatus: Parameters<typeof summarizeGuests>[0][number]["rsvpStatus"];
  plusOnes: number;
  checkedInAt: Date | null;
  arrivedWithoutRsvp: boolean;
};

/**
 * Pure, so it can be tested without a database.
 *
 * `expectedHeads` is deliberately the app's own published estimate rather than
 * a new calculation — the point is to score the number the host was actually
 * shown, not a better one invented afterwards.
 */
export function countOutcome(
  event: { guestCount: number },
  guests: GuestRow[],
): OutcomeCounts {
  const summary = summarizeGuests(guests);
  const expected = effectiveHeadcount(event.guestCount, summary);

  const checkedIn = guests.filter((g) => g.checkedInAt).length;
  const walkUps = guests.filter((g) => g.checkedInAt && g.arrivedWithoutRsvp).length;

  return {
    expectedHeads: expected.count,
    attendingAtClose: summary.attending,
    checkedIn,
    walkUps,
    capacity: event.guestCount,
  };
}

/** When an event's door has closed, allowing for a late finish. */
export function hasFinished(
  event: { date: Date | null; endDate: Date | null; durationHours: number },
  now = new Date(),
): boolean {
  if (!event.date) return false;
  const end = event.endDate ?? new Date(event.date.getTime() + event.durationHours * 3_600_000);
  return now.getTime() > end.getTime() + GRACE_MS;
}

/** How many other things were on at that school that day. Null when unknown. */
async function conflictsFor(schoolDomain: string | null, date: Date | null): Promise<number | null> {
  if (!schoolDomain || !date) return null;
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  return db.campusEvent.count({
    where: { schoolDomain, startsAt: { gte: dayStart, lt: dayEnd } },
  });
}

export type CompletionResult = { completed: number; skipped: number };

/**
 * Closes every event whose night has passed and records its outcome.
 *
 * Idempotent in both directions: an event already marked COMPLETED is skipped,
 * and the outcome row is created only if one does not exist, so re-running the
 * sweep can never double-count or rewrite history.
 */
export async function completeFinishedEvents(now = new Date()): Promise<CompletionResult> {
  const candidates = await db.event.findMany({
    where: { status: { not: "COMPLETED" }, date: { not: null, lt: now } },
    select: {
      id: true,
      date: true,
      endDate: true,
      durationHours: true,
      guestCount: true,
      schoolDomain: true,
      guests: {
        select: { rsvpStatus: true, plusOnes: true, checkedInAt: true, arrivedWithoutRsvp: true },
      },
    },
    take: 500,
  });

  let completed = 0;
  let skipped = 0;

  for (const event of candidates) {
    if (!hasFinished(event, now)) {
      skipped += 1;
      continue;
    }

    const counts = countOutcome(event, event.guests);
    const campusConflicts = await conflictsFor(event.schoolDomain, event.date);

    await db.$transaction([
      db.event.update({ where: { id: event.id }, data: { status: "COMPLETED" } }),
      // Written once. A second sweep finds the row and leaves it alone.
      db.eventOutcome.upsert({
        where: { eventId: event.id },
        create: { eventId: event.id, ...counts, campusConflicts },
        update: {},
      }),
    ]);
    completed += 1;
  }

  return { completed, skipped };
}
