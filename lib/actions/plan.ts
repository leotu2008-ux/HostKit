"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { generatePlan } from "@/lib/plan";
import { removableTaskWhere, tasksToReplace } from "@/lib/replan";

/**
 * Re-drafts the timeline without touching what the host already did:
 * a task the app generated and nobody has started is fair game, but a task
 * the host wrote themselves, or already ticked off, survives untouched.
 *
 * Budget categories are left alone entirely — they're keyed one-per-category
 * per event and BudgetItem rows reference real bookings through them, so
 * rewriting them here would orphan those bookings.
 */
export async function regeneratePlanAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  const existing = await db.task.findMany({ where: { eventId } });
  const { remove } = tasksToReplace(existing);

  const plan = generatePlan({
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
  });

  await db.$transaction(async (tx) => {
    // Re-checks source/status against current state rather than trusting the
    // snapshot `remove` was built from — see removableTaskWhere.
    await tx.task.deleteMany({ where: removableTaskWhere(remove) });
    await tx.task.createMany({
      data: plan.tasks.map((t) => ({
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
  });

  refresh();
}
