"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { generatePlan, type PlanInput } from "@/lib/plan";
import { dedupeGeneratedTasks, removableTaskWhere, tasksToReplace } from "@/lib/replan";

/**
 * The actual redraft, shared by the "redraft" button below and by
 * saveBriefAction's one-time first draft (lib/actions/brief.ts) when a brief
 * completes on an event that has no plan yet — Milestone 1 doesn't run the
 * agent, so this is what stands in for it until Milestone 3.
 *
 * Re-drafts the timeline without touching what the host already did: a task
 * the app generated and nobody has started is fair game, but a task the host
 * wrote themselves, or already ticked off, survives untouched.
 *
 * Budget categories are only ever created, never rewritten: they're keyed
 * one-per-category per event and BudgetItem rows reference real bookings
 * through them, so touching an existing category would orphan those
 * bookings. A blank event has none yet — that's the only case this creates
 * them.
 */
export async function regenerateTasksAndCategories(eventId: string, input: PlanInput) {
  const existing = await db.task.findMany({ where: { eventId } });
  const { remove, keep } = tasksToReplace(existing);

  const plan = generatePlan(input);

  // A kept task (HUMAN, or GENERATED-and-DONE) already represents this piece
  // of work; re-inserting its generated twin as a new TODO would undo it —
  // see dedupeGeneratedTasks.
  const tasksToInsert = dedupeGeneratedTasks(plan.tasks, keep);

  await db.$transaction(async (tx) => {
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

    const categoryCount = await tx.budgetCategory.count({ where: { eventId } });
    if (categoryCount === 0) {
      await tx.budgetCategory.createMany({
        data: plan.categories.map((c) => ({
          eventId,
          category: c.category,
          name: c.name,
          allocatedCents: c.allocatedCents,
        })),
      });
    }
  });
}

export async function regeneratePlanAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  await regenerateTasksAndCategories(eventId, {
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
  });

  refresh();
}
