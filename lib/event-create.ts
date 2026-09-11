import type {
  EventType,
  EventVisibility,
  TicketType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { generatePlan } from "@/lib/plan";

export type NewEvent = {
  ownerId: string | null;
  claimToken: string | null;
  title: string;
  type: EventType;
  date: Date | null;
  durationHours: number;
  guestCount: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  budgetTotalCents: number;
  description: string | null;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  published: boolean;
};

/**
 * Creates an event with its generated budget and timeline, in one
 * transaction: an event that exists without its plan would show the host an
 * empty planner with no way to regenerate it.
 *
 * Lives outside `lib/actions` because "use server" files may only export
 * async actions, and both the web form and the iOS API need it.
 */
export async function createEventWithPlan(input: NewEvent) {
  const plan = generatePlan({
    type: input.type,
    date: input.date,
    budgetTotalCents: input.budgetTotalCents,
  });

  return db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: { ...input, vibe: input.description },
    });

    await tx.budgetCategory.createMany({
      data: plan.categories.map((c) => ({
        eventId: created.id,
        category: c.category,
        name: c.name,
        allocatedCents: c.allocatedCents,
      })),
    });

    await tx.task.createMany({
      data: plan.tasks.map((t) => ({
        eventId: created.id,
        title: t.title,
        notes: t.notes ?? null,
        offsetDays: t.offsetDays,
        category: t.category ?? null,
        dueDate: t.dueDate,
      })),
    });

    return created;
  });
}
