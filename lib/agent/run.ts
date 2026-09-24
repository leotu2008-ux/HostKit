import { db } from "@/lib/db";
import { briefHash, briefIsComplete } from "@/lib/brief";
import { isCity } from "@/lib/catalog";
import { record, type ActivityLine } from "@/lib/activity";
import { LIMITS, RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { isVenueSearchConfigured } from "@/lib/venues/search";
import {
  foundNothing,
  planSteps,
  runSummaryBody,
  skippedSteps,
  vendorCategories,
  type Step,
  type StepContext,
  type StepName,
} from "@/lib/agent/steps";
import { applyDraftedPlan } from "@/lib/agent/plan-step";
import { attachTopVenues } from "@/lib/agent/venue-step";
import { draftVendorInquiries } from "@/lib/agent/vendor-step";

/**
 * One run of the agent over one event: draft the plan, find a venue, draft the
 * vendor inquiries, and post every step to the activity feed. Nothing here
 * sends, publishes or spends — every message it writes waits on a host click.
 *
 * **The AgentRun row is the idempotency guarantee, and it has to be the
 * database's job.** `@@unique([eventId, briefHash])` is what makes "the same
 * brief" a fact two concurrent invocations can't disagree about: the claim is
 * an insert that one of them loses. Serverless instances share no memory, a
 * host can double-save a form, and the cron sweep can wake at the same moment
 * — an in-process lock or a read-then-write check would let all three through.
 * A run that died mid-flight is reclaimable after STALE_RUN_MS, so a crashed
 * instance doesn't wedge an event forever.
 *
 * **Nothing here throws.** runAgent runs inside `after()`, where the response
 * is already gone and a throw is invisible to everyone — the host sees a
 * silently idle agent and there's nothing in the feed to explain it. So every
 * failure becomes a returned outcome or a recorded line instead.
 *
 * **Each step is wrapped individually.** The three steps are independent work:
 * a Maps outage must not cost the host their plan, and a category with no
 * viable vendor must not lose the venues already found. runStep turns any one
 * step's failure into its own feed line and lets the rest run.
 */

/** Vercel's ceiling is 60s; leave headroom for the response and the closing writes. */
export const AGENT_TIME_BUDGET_MS = 45_000;
export const STALE_RUN_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 3;

export type RunReason = "brief" | "manual" | "cron";

export type RunOutcome = {
  ran: boolean;
  skipped?: "incomplete" | "running" | "unchanged" | "rate-limited" | "gone";
  runId?: string;
  steps?: Array<{ name: StepName; ok: boolean; note: string }>;
};

export type RunOptions = {
  reason: RunReason;
  /** The caller's address, for the anonymous-draft limit. Null when the event
   *  has an owner, and absent from the cron (which has no request to read). */
  ipKey?: string | null;
  now?: Date;
  /** How long this run may spend on steps, when the caller has less than
   *  AGENT_TIME_BUDGET_MS to give it — the cron sweep runs several events
   *  inside one function invocation and has to share its ceiling out. Never
   *  raises the budget above the default. */
  budgetMs?: number;
  /** Injectable for tests; forwarded to the model-backed steps. */
  fetchImpl?: typeof fetch;
};

/** The feed line for a step that was never attempted. */
const SKIP_TITLE: Record<StepName, string> = {
  plan: "Skipped the plan",
  venues: "Didn't look for venues",
  vendors: "Didn't draft vendor inquiries",
};

/** The feed line for a step that was attempted and broke. */
const FAILED_TITLE: Record<StepName, string> = {
  plan: "Couldn't draft the plan",
  venues: "Couldn't find venues",
  vendors: "Couldn't draft vendor inquiries",
};

/** `empty`: the step ran cleanly but turned up nothing (see foundNothing). */
type StepResult = { name: StepName; ok: boolean; empty: boolean; note: string };

/**
 * Runs one step against the wall clock and the feed. Out of time, it says so
 * and leaves the work for the next run (the cron sweep picks the row up);
 * broken, it records why in 200 characters and returns — never rethrows, so
 * the steps after it still get their turn.
 */
async function runStep(
  eventId: string,
  step: Step,
  deadline: number,
  fn: () => Promise<ActivityLine>,
): Promise<StepResult> {
  if (Date.now() >= deadline) {
    const note = "Ran out of time — the agent will pick this up";
    await record(eventId, {
      actor: "agent",
      kind: "step_skipped",
      title: SKIP_TITLE[step.name],
      body: note,
    });
    return { name: step.name, ok: false, empty: false, note };
  }

  try {
    const line = await fn();
    await record(eventId, line);
    return { name: step.name, ok: true, empty: foundNothing(line), note: line.title };
  } catch (error) {
    const note = String(error instanceof Error ? error.message : error).slice(0, 200);
    await record(eventId, {
      actor: "agent",
      kind: "step_failed",
      title: FAILED_TITLE[step.name],
      body: note,
    });
    return { name: step.name, ok: false, empty: false, note };
  }
}

/** The plan-dependent half of the context: what the budget allocates, and
 *  what already has an inquiry out. Re-read after the plan step, since that's
 *  what writes the categories the vendor step shops for. */
async function loadCategoryContext(eventId: string) {
  const [allocated, inquiries] = await Promise.all([
    db.budgetCategory.findMany({
      where: { eventId, allocatedCents: { gt: 0 } },
      select: { category: true },
      orderBy: { allocatedCents: "desc" },
    }),
    db.inquiry.findMany({
      where: { eventId },
      select: { listing: { select: { category: true } } },
    }),
  ]);
  return {
    plannedCategories: allocated.map((row) => row.category),
    categoriesWithInquiry: inquiries.map((row) => row.listing.category),
  };
}

/**
 * The never-throws boundary. Anything the orchestration itself couldn't
 * handle — the database going away mid-run, most likely — is logged and
 * returned as "didn't run" rather than thrown into `after()`, where nobody
 * would ever see it. A row left RUNNING by such a failure goes stale after
 * STALE_RUN_MS and the cron sweep reclaims it.
 */
export async function runAgent(eventId: string, options: RunOptions): Promise<RunOutcome> {
  try {
    return await attemptRun(eventId, options);
  } catch (error) {
    console.error("[agent] run failed", error);
    return { ran: false };
  }
}

async function attemptRun(eventId: string, options: RunOptions): Promise<RunOutcome> {
  const now = options.now ?? new Date();
  const { reason } = options;

  const event = await db.event.findFirst({
    where: { id: eventId },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!event) return { ran: false, skipped: "gone" };

  const hash = briefHash(event);

  // Only an automatic run needs a complete brief: the host pressing the button
  // on a half-filled one still gets whatever planSteps says is runnable.
  if (reason === "brief" && !briefIsComplete(event)) {
    return { ran: false, skipped: "incomplete" };
  }

  // Claim the run by inserting it. Losing the insert is not an error — it
  // means somebody else already owns this brief.
  let runId: string;
  try {
    const created = await db.agentRun.create({
      data: { eventId, briefHash: hash, reason, status: "RUNNING", startedAt: now, attempts: 1 },
    });
    runId = created.id;
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;

    const existing = await db.agentRun.findUnique({
      where: { eventId_briefHash: { eventId, briefHash: hash } },
    });
    if (!existing) return { ran: false, skipped: "running" };

    const staleBefore = new Date(now.getTime() - STALE_RUN_MS);
    if (existing.status === "RUNNING" && existing.startedAt && existing.startedAt > staleBefore) {
      return { ran: false, skipped: "running" };
    }
    // "The briefHash hasn't changed", as a database fact rather than a guess:
    // this exact brief has already been worked, so a resave that touched
    // nothing the agent reads must not run it again.
    if (reason === "brief" && existing.status === "DONE") {
      return { ran: false, skipped: "unchanged" };
    }

    // Re-claim, with the same staleness test in the WHERE so two callers
    // racing to revive one dead run can't both win it.
    const reclaimed = await db.agentRun.updateMany({
      where: {
        id: existing.id,
        OR: [{ status: { not: "RUNNING" } }, { startedAt: { lt: staleBefore } }],
      },
      data: {
        status: "RUNNING",
        startedAt: now,
        finishedAt: null,
        reason,
        attempts: { increment: 1 },
      },
    });
    if (reclaimed.count === 0) return { ran: false, skipped: "running" };
    runId = existing.id;
  }

  try {
    await assertRateLimit(`agent:event:${eventId}`, ...LIMITS.agentRun.perEvent);
    if (event.ownerId === null) {
      // An unclaimed draft has no account to bill the work to, so the address
      // is the only handle there is.
      if (options.ipKey) {
        await assertRateLimit(`agent:ip:${options.ipKey}`, ...LIMITS.agentRun.perIp);
      }
    } else {
      await assertRateLimit(`agent:user:${event.ownerId}`, ...LIMITS.agentRun.perOwner);
    }
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    // QUEUED, not FAILED: nothing went wrong with the work, it just hasn't
    // happened yet — and that's exactly what the cron sweep looks for.
    await db.agentRun.update({
      where: { id: runId },
      data: { status: "QUEUED", startedAt: null },
    });
    return { ran: false, skipped: "rate-limited" };
  }

  await record(eventId, {
    actor: "agent",
    kind: "run_started",
    title: "The agent is working on this",
  });

  const [categoryContext, venueCollaborators, bookedVenueInquiries, planCount] = await Promise.all([
    loadCategoryContext(eventId),
    db.eventCollaborator.count({ where: { eventId, kind: "VENUE" } }),
    db.inquiry.count({
      where: { eventId, status: "BOOKED", listing: { category: "VENUE" } },
    }),
    db.budgetCategory.count({ where: { eventId } }),
  ]);

  let context: StepContext = {
    hasPlan: planCount > 0,
    hasVenue: venueCollaborators > 0 || bookedVenueInquiries > 0,
    venueSearchConfigured: isVenueSearchConfigured(),
    cityIsScoutable: isCity(event.city),
    ...categoryContext,
  };

  const steps = planSteps(event, context);
  const byName = new Map(steps.map((step) => [step.name, step]));

  for (const skipped of skippedSteps(event, context)) {
    await record(eventId, {
      actor: "agent",
      kind: "step_skipped",
      title: SKIP_TITLE[skipped.name],
      body: skipped.why,
    });
  }

  const deadline = Date.now() + Math.min(options.budgetMs ?? AGENT_TIME_BUDGET_MS, AGENT_TIME_BUDGET_MS);
  const results: StepResult[] = [];

  const planStep = byName.get("plan");
  if (planStep) {
    const result = await runStep(eventId, planStep, deadline, () =>
      applyDraftedPlan(event, { fetchImpl: options.fetchImpl }),
    );
    results.push(result);
    if (result.ok) {
      // The categories the vendor step shops for were just written.
      context = { ...context, hasPlan: true, ...(await loadCategoryContext(eventId)) };
    }
  }

  const venueStep = byName.get("venues");
  if (venueStep) {
    results.push(
      await runStep(eventId, venueStep, deadline, () =>
        attachTopVenues(event, { fetchImpl: options.fetchImpl }),
      ),
    );
  }

  const vendorStep = byName.get("vendors");
  if (vendorStep) {
    results.push(
      await runStep(eventId, vendorStep, deadline, () =>
        draftVendorInquiries(event, vendorCategories(context)),
      ),
    );
  }

  const allOk = results.every((result) => result.ok);
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: allOk ? "DONE" : "FAILED",
      finishedAt: new Date(),
      note: JSON.stringify(results),
    },
  });

  await record(eventId, {
    actor: "agent",
    kind: "run_finished",
    title: allOk ? "The agent finished" : "The agent finished with problems",
    // Every step can be skipped before it's attempted (a manual run on a
    // brief with nothing runnable in it) or find nothing, and the lines
    // above already said why.
    body: runSummaryBody(results),
  });

  return { ran: true, runId, steps: results };
}
