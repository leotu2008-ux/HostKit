import { db } from "@/lib/db";
import { briefIsComplete } from "@/lib/brief";
import { MAX_ATTEMPTS, STALE_RUN_MS, runAgent } from "@/lib/agent/run";

/**
 * The safety net behind `after()`: once a day, pick up the runs that never
 * finished and the events that never started one.
 *
 * Two kinds of gap. A run can be left QUEUED by the rate limit, FAILED by a
 * step that broke, or RUNNING by an instance that died — all recoverable, and
 * all invisible to the host unless something comes back for them. And an
 * event can reach a complete brief without any `after()` ever firing: the iOS
 * API writes events through its own routes, and a dropped invocation loses
 * the callback entirely. Neither case should need a host to notice and press
 * a button.
 *
 * Deliberately small and time-boxed: five events, 50 seconds. A sweep that
 * tried to catch up on everything would blow the function's ceiling and
 * finish none of it — tomorrow's run takes the rest.
 */

export const SWEEP_LIMIT = 5;
const SWEEP_DEADLINE_MS = 50_000;

export type SweepResult = {
  /** Events found worth a run. `ran + skipped` is lower when the deadline
   *  cut the sweep short — the next one picks those up. */
  swept: number;
  ran: number;
  skipped: number;
};

export async function sweepAgentRuns(now = new Date()): Promise<SweepResult> {
  const staleBefore = new Date(now.getTime() - STALE_RUN_MS);

  const [unfinished, neverRun] = await Promise.all([
    db.agentRun.findMany({
      where: {
        // A cancelled or already-finished event has nothing left to plan.
        event: { status: "PLANNING" },
        OR: [
          { status: "QUEUED" },
          { status: "FAILED", attempts: { lt: MAX_ATTEMPTS } },
          { status: "RUNNING", startedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: SWEEP_LIMIT,
      select: { eventId: true },
    }),
    db.event.findMany({
      where: {
        status: "PLANNING",
        agentRuns: { none: {} },
        // The cheap half of briefIsComplete, as SQL. The rest of it (is this
        // a city HostKit knows?) is checked below — it can't be expressed
        // here, and a prefilter this narrow leaves little to throw away.
        kind: { not: null },
        date: { not: null },
        city: { not: "" },
        guestCount: { gt: 0 },
        budgetTotalCents: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
      take: SWEEP_LIMIT * 2,
    }),
  ]);

  const candidates = [
    ...unfinished.map((run) => run.eventId),
    ...neverRun.filter(briefIsComplete).map((event) => event.id),
  ];
  // An event can appear in both lists; run it once.
  const eventIds = [...new Set(candidates)].slice(0, SWEEP_LIMIT);

  const deadline = Date.now() + SWEEP_DEADLINE_MS;
  let ran = 0;
  let skipped = 0;

  for (const eventId of eventIds) {
    if (Date.now() >= deadline) break;
    // No ipKey: the cron has no request to read an address from, so an
    // unclaimed draft is limited per event only.
    const outcome = await runAgent(eventId, { reason: "cron" });
    if (outcome.ran) ran += 1;
    else skipped += 1;
  }

  return { swept: eventIds.length, ran, skipped };
}
