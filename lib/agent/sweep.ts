import { db } from "@/lib/db";
import { briefHash, briefIsComplete } from "@/lib/brief";
import { MAX_ATTEMPTS, STALE_RUN_MS, runAgent } from "@/lib/agent/run";
import { sweepPlan, type SweepCandidate, type SweepEvent } from "@/lib/agent/sweep-plan";

/**
 * The safety net behind `after()`: once a day, pick up the runs that never
 * finished and the events whose brief nothing has planned.
 *
 * Two kinds of gap. A run can be left QUEUED by the rate limit, FAILED by a
 * step that broke, or RUNNING by an instance that died — all recoverable, and
 * all invisible to the host unless something comes back for them. And an
 * event can reach a complete brief without any `after()` ever firing: the iOS
 * API writes events through its own routes, and a dropped invocation loses
 * the callback entirely. Neither case should need a host to notice and press
 * a button.
 *
 * The second gap is why the candidate scan below is every PLANNING event with
 * a complete brief rather than only the events with no runs at all. An event
 * whose last run finished DONE and whose brief was *then* edited has no
 * unfinished row and is not run-less either: the lost follow-up leaves the
 * host looking at "Idle · ran 3d ago" against a brief the agent never read.
 * Scanning is cheap (one bounded query plus one hash each, in JS); it's the
 * runs that are expensive, and SWEEP_LIMIT still caps those at five.
 *
 * Which of those rows are actually retryable is sweepPlan's decision, not a
 * property of the selector — see lib/agent/sweep-plan.ts for why an
 * unfinished row can be permanently unreachable.
 *
 * Deliberately small and time-boxed: five events inside one function
 * invocation's ceiling. A sweep that tried to catch up on everything would
 * blow that ceiling and finish none of it — tomorrow's run takes the rest.
 */

export const SWEEP_LIMIT = 5;

/** The whole sweep's share of `maxDuration = 60`, leaving headroom for the
 *  response and the closing writes. */
const SWEEP_DEADLINE_MS = 50_000;

/** Below this there isn't time for a model call and its writes, so the sweep
 *  stops rather than claiming a row it would only have to abandon. Above it,
 *  a run handed less than it wants degrades on its own: the plan step gets
 *  its turn and runStep records "ran out of time" for the rest, which the
 *  next sweep picks up. */
const MIN_RUN_SLICE_MS = 12_000;

/** Candidates are read well above SWEEP_LIMIT so a batch of unreachable rows
 *  is retired in the same sweep that still does real work. */
const CANDIDATE_TAKE = SWEEP_LIMIT * 5;

/** How many PLANNING events one sweep looks at, soonest first — the same
 *  bound and ordering lib/agent/digest.ts scans with, and for the same
 *  reason: this set never drains on its own, so without an order the cap
 *  would drop tomorrow's night in favour of one eight months out. Past-dated
 *  events sort first but don't accumulate: the close-events cron moves them
 *  out of PLANNING daily (lib/outcomes.ts). */
const EVENT_SCAN_TAKE = 500;

export type SweepResult = {
  /** Events found worth a run. `ran + skipped` is lower when the sweep's
   *  clock cut it short — the next one picks those up. */
  swept: number;
  ran: number;
  skipped: number;
  /** Unfinished rows no run could ever reach again, closed out. */
  retired: number;
};

export async function sweepAgentRuns(now = new Date()): Promise<SweepResult> {
  const staleBefore = new Date(now.getTime() - STALE_RUN_MS);

  const [unfinished, scanned] = await Promise.all([
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
      take: CANDIDATE_TAKE,
      // The event's current brief, to hash against the row's own.
      include: { event: true },
    }),
    db.event.findMany({
      where: {
        status: "PLANNING",
        // The cheap half of briefIsComplete, as SQL. The rest of it (is this
        // a city Hosty knows?) is checked below — it can't be expressed
        // here, and a prefilter this narrow leaves little to throw away.
        kind: { not: null },
        date: { not: null },
        city: { not: "" },
        guestCount: { gt: 0 },
        budgetTotalCents: { gt: 0 },
      },
      orderBy: { date: "asc" },
      take: EVENT_SCAN_TAKE,
    }),
  ]);

  const complete = scanned.filter(briefIsComplete);

  // The brief each event carries *now*, hashed once per event whichever input
  // it came in on — a candidate row's `include: { event: true }` and the scan
  // are the same row read twice.
  const currentHash = new Map<string, string>();
  for (const run of unfinished) currentHash.set(run.eventId, briefHash(run.event));
  for (const event of complete) {
    if (!currentHash.has(event.id)) currentHash.set(event.id, briefHash(event));
  }

  // Which of those briefs already have a run — one query for the whole batch,
  // and the one fact both inputs are decided on: it tells an old attempt's
  // corpse from an event whose follow-up run was lost, and a scanned event
  // the agent has read from one it hasn't.
  //
  // Pairs rather than `eventId in (…) AND briefHash in (…)`: two events with
  // identical brief facts hash the same (the seeded test events do), so a
  // cross-product would report a run against the wrong event. Each pair hits
  // the @@unique([eventId, briefHash]) index.
  const currentPairs = [...currentHash].map(([eventId, hash]) => ({
    eventId,
    briefHash: hash,
  }));
  const existing = new Set(
    (currentPairs.length === 0
      ? []
      : await db.agentRun.findMany({
          where: { OR: currentPairs },
          select: { eventId: true, briefHash: true },
        })
    ).map((row) => `${row.eventId}:${row.briefHash}`),
  );

  const candidates: SweepCandidate[] = unfinished.map((run) => {
    const currentBriefHash = currentHash.get(run.eventId)!;
    return {
      id: run.id,
      eventId: run.eventId,
      briefHash: run.briefHash,
      currentBriefHash,
      currentBriefHasRun: existing.has(`${run.eventId}:${currentBriefHash}`),
    };
  });

  const events: SweepEvent[] = complete.map((event) => ({
    id: event.id,
    currentBriefHasRun: existing.has(`${event.id}:${currentHash.get(event.id)}`),
  }));

  const plan = sweepPlan(candidates, events, SWEEP_LIMIT);

  if (plan.retire.length > 0) {
    // At MAX_ATTEMPTS so the row stops matching the selector above. The
    // event's real work happens through the row for its current brief.
    await db.agentRun.updateMany({
      where: { id: { in: plan.retire } },
      data: { status: "FAILED", attempts: MAX_ATTEMPTS, finishedAt: now },
    });
  }

  const deadline = Date.now() + SWEEP_DEADLINE_MS;
  let ran = 0;
  let skipped = 0;

  for (const eventId of plan.run) {
    // Checked against what a run could still *need*, not just against zero:
    // starting a 45s run with 1s left would be killed mid-flight and leave a
    // RUNNING row behind. Each run is handed only the time actually left.
    const remaining = deadline - Date.now();
    if (remaining < MIN_RUN_SLICE_MS) break;

    // No ipKey: the cron has no request to read an address from, so an
    // unclaimed draft is limited per event only.
    const outcome = await runAgent(eventId, { reason: "cron", budgetMs: remaining });
    if (outcome.ran) ran += 1;
    else skipped += 1;
  }

  return { swept: plan.run.length, ran, skipped, retired: plan.retire.length };
}
