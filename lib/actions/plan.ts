"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { generatePlan, type GeneratedPlan, type PlanInput } from "@/lib/plan";
import { dedupeGeneratedTasks, removableTaskWhere, tasksToReplace } from "@/lib/replan";
import { briefIsComplete } from "@/lib/brief";

export type RegenerateOptions = {
  /** A plan the caller already drafted — the agent's model-backed draftPlan
   *  (lib/agent/plan-step.ts). Omitted, the heuristic draws one. */
  plan?: GeneratedPlan;
  /** Also bring existing GENERATED categories' name and allocation up to
   *  date. The "redraft the plan" button deliberately doesn't: it re-draws
   *  the timeline from unchanged facts, so rewriting allocations the host may
   *  have since tuned would be a surprise. The agent's plan step does,
   *  because it only ever runs on a brief that actually changed — a new
   *  budget has to reach the categories or the split is stale. */
  refreshGeneratedCategories?: boolean;
};

/**
 * The actual redraft, shared by the "redraft" button below and by the agent's
 * plan step (lib/agent/plan-step.ts) — one definition of what a redraft is
 * allowed to touch, whoever asked for it.
 *
 * Re-drafts the timeline without touching what the host already did: a task
 * the app generated and nobody has started is fair game, but a task the host
 * wrote themselves, or already ticked off, survives untouched.
 *
 * Budget categories are never deleted: they're keyed one-per-category per
 * event and BudgetItem rows reference real bookings through them, so removing
 * one would orphan those bookings, and a HUMAN row is the host's own. The
 * insert always runs with `skipDuplicates: true` rather than a
 * count-then-insert check: `@@unique([eventId, category])` means a category
 * that already exists is silently skipped, which is what makes it safe for
 * two concurrent callers (e.g. two racing brief-completion saves) to both
 * reach this without either producing a duplicate row.
 *
 * Returns what the event ended up with, for the activity line the agent posts.
 */
export async function regenerateTasksAndCategories(
  eventId: string,
  input: PlanInput,
  options: RegenerateOptions = {},
): Promise<{ tasks: number; categories: number }> {
  const existing = await db.task.findMany({ where: { eventId } });
  const { remove, keep } = tasksToReplace(existing);

  const plan = options.plan ?? generatePlan(input);

  // A kept task (HUMAN, or GENERATED-and-DONE) already represents this piece
  // of work; re-inserting its generated twin as a new TODO would undo it —
  // see dedupeGeneratedTasks.
  const tasksToInsert = dedupeGeneratedTasks(plan.tasks, keep);

  return db.$transaction(async (tx) => {
    // Re-checks source/status against current state rather than trusting the
    // snapshot `remove` was built from — see removableTaskWhere.
    await tx.task.deleteMany({ where: removableTaskWhere(remove) });
    await tx.task.createMany({
      data: tasksToInsert.map((t) => ({
        eventId,
        title: t.title,
        notes: t.notes ?? null,
        offsetDays: t.offsetDays,
        category: t.category ?? null,
        dueDate: t.dueDate,
        // Explicit, not relied on as the schema default — this is the whole
        // feature's second-use guarantee.
        source: "GENERATED" as const,
      })),
    });

    if (options.refreshGeneratedCategories) {
      for (const c of plan.categories) {
        // Scoped to GENERATED so a category the host took over keeps the
        // name and number they gave it.
        await tx.budgetCategory.updateMany({
          where: { eventId, category: c.category, source: "GENERATED" },
          data: { name: c.name, allocatedCents: c.allocatedCents },
        });
      }
    }

    await tx.budgetCategory.createMany({
      data: plan.categories.map((c) => ({
        eventId,
        category: c.category,
        name: c.name,
        allocatedCents: c.allocatedCents,
      })),
      skipDuplicates: true,
    });

    return {
      tasks: await tx.task.count({ where: { eventId } }),
      categories: await tx.budgetCategory.count({ where: { eventId } }),
    };
  });
}

/**
 * A blank or half-finished brief has no real facts to draft a plan from —
 * MIXER/$0/no-date isn't a plan, it's the schema defaults. Drafting one
 * anyway would be actively harmful: it plants budgetCategory rows for the
 * event, and saveBriefAction's one-time bridge (lib/actions/brief.ts) only
 * ever fires when an event has none yet, so a premature redraft here would
 * permanently block the real plan from ever being drafted once the brief
 * completes.
 */
export async function regeneratePlanAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  if (!briefIsComplete(event)) {
    redirect(`/events/${eventId}/brief`);
  }

  await regenerateTasksAndCategories(eventId, {
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
  });

  refresh();
}
