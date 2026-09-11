"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generatePlan, startOfDay } from "@/lib/plan";
import { parseCents } from "@/lib/money";
import { ALL_EVENT_TYPES, CITIES, EVENT_TYPE_LABEL } from "@/lib/catalog";

export type EventFormState = { error?: string } | undefined;

const schema = z.object({
  type: z.enum(ALL_EVENT_TYPES as [string, ...string[]]),
  title: z.string().trim().max(120).optional(),
  date: z.string().trim(),
  guestCount: z.coerce.number().int().min(1, "At least one guest.").max(100_000),
  durationHours: z.coerce.number().int().min(1).max(24),
  city: z.enum(CITIES as unknown as [string, ...string[]]),
  budget: z.string().trim(),
  vibe: z.string().trim().max(280).optional(),
});

export async function createEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  const budgetTotalCents = parseCents(input.budget);
  if (budgetTotalCents === null || budgetTotalCents === 0) {
    return { error: "Enter a budget, even a rough one — the plan is built from it." };
  }

  // An empty date input is a legitimate answer: plenty of events start before
  // the date is settled, and generatePlan handles a null date.
  let date: Date | null = null;
  if (input.date) {
    const parsedDate = new Date(`${input.date}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "That date doesn't look right." };
    }
    date = startOfDay(parsedDate);
  }

  const type = input.type as (typeof ALL_EVENT_TYPES)[number];
  const title =
    input.title && input.title.length > 0
      ? input.title
      : `${EVENT_TYPE_LABEL[type]} in ${input.city.split(",")[0]}`;

  const plan = generatePlan({ type, date, budgetTotalCents });

  // One transaction: an event that exists without its plan would show the
  // host an empty dashboard with no way to regenerate it.
  const event = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        ownerId: user.id,
        title,
        type,
        date,
        durationHours: input.durationHours,
        guestCount: input.guestCount,
        city: input.city,
        budgetTotalCents,
        vibe: input.vibe || null,
      },
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

  redirect(`/events/${event.id}`);
}
