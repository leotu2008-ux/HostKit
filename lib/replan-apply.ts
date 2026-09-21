import { db } from "@/lib/db";
import { generatePlan, type GeneratedPlan, type PlanInput } from "@/lib/plan";
import { dedupeGeneratedTasks, removableTaskWhere, tasksToReplace } from "@/lib/replan";

/**
 * Writing a redraft to the database: the rules in lib/replan.ts applied to
 * one event's rows.
 *
 * Deliberately NOT in lib/actions/. Next publishes every export of a
 * `"use server"` module as a callable endpoint, and this function takes a
 * caller-supplied plan — task titles, notes, category names, allocations —
 * for an arbitrary event id. Exported from there it would be an
 * unauthenticated write of attacker-chosen text into any event's plan. Here
 * it is an ordinary module: regeneratePlanAction (which does the
 * requireEvent) and the agent's plan step both import it, and neither the
 * network nor a browser can reach it directly.
 */

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
 * The actual redraft, shared by the "redraft the plan" button
 * (lib/actions/plan.ts) and the agent's plan step (lib/agent/plan-step.ts) —
 * one definition of what a redraft is allowed to touch, whoever asked for it.
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
