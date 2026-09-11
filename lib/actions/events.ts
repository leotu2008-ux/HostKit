"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requireEvent, requireUser } from "@/lib/session";
import { generatePlan } from "@/lib/plan";
import { parseCents } from "@/lib/money";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { newClaimToken, rememberDraftClaim } from "@/lib/drafts";

export type EventFormState = { error?: string } | undefined;

const VISIBILITY = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
const TICKETS = ["FREE", "PAID"] as const;

const schema = z.object({
  type: z.enum(ALL_EVENT_TYPES as [string, ...string[]]),
  title: z.string().trim().min(1, "Name this night.").max(120),
  date: z.string().trim(),
  time: z.string().trim(),
  guestCount: z.coerce.number().int().min(1, "At least one person.").max(100_000),
  durationHours: z.coerce.number().int().min(1).max(24),
  city: z.enum(CITIES as unknown as [string, ...string[]]),
  address: z.string().trim().max(200).optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  budget: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  ticketType: z.enum(TICKETS),
  ticketPrice: z.string().trim().optional(),
  visibility: z.enum(VISIBILITY),
});

function parseCoord(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseStart(date: string, time: string): Date | null {
  if (!date) return null;
  const clock = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  const parsedDate = new Date(`${date}T${clock}:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

export async function createEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await getCurrentUser();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  let budgetTotalCents = 0;
  if (input.budget) {
    const cents = parseCents(input.budget);
    if (cents === null) return { error: "That planning budget doesn't look right." };
    budgetTotalCents = cents;
  }

  let ticketPriceCents = 0;
  if (input.ticketType === "PAID") {
    const cents = parseCents(input.ticketPrice ?? "");
    if (cents === null || cents === 0) {
      return { error: "Add a ticket price, or switch ticketing to Free." };
    }
    ticketPriceCents = cents;
  }

  const date = parseStart(input.date, input.time);
  if (input.date && !date) {
    return { error: "That date and time don't look right." };
  }

  const type = input.type as (typeof ALL_EVENT_TYPES)[number];
  const lat = parseCoord(input.lat);
  const lng = parseCoord(input.lng);
  const address = input.address || null;
  const claimToken = user ? null : newClaimToken();

  const plan = generatePlan({ type, date, budgetTotalCents });

  const event = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        ownerId: user?.id ?? null,
        claimToken,
        title: input.title,
        type,
        date,
        durationHours: input.durationHours,
        guestCount: input.guestCount,
        city: input.city,
        address,
        lat,
        lng,
        budgetTotalCents,
        description: input.description || null,
        vibe: input.description || null,
        ticketType: input.ticketType,
        ticketPriceCents,
        visibility: input.visibility,
        published: false,
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

  if (claimToken) {
    await rememberDraftClaim({ id: event.id, token: claimToken });
  }

  redirect(`/events/${event.id}`);
}

export async function publishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(`/events/${eventId}`)}&publish=1`,
    );
  }
  const { event } = await requireEvent(eventId);
  if (!event.ownerId) {
    await db.event.update({
      where: { id: event.id },
      data: { ownerId: user.id, published: true },
    });
  } else {
    await db.event.update({
      where: { id: event.id },
      data: { published: true },
    });
  }
  refresh();
}

export async function unpublishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await requireUser(`/events/${eventId}`);
  const { event } = await requireEvent(eventId);
  await db.event.update({
    where: { id: event.id },
    data: { published: false },
  });
  refresh();
}

export async function setPublishedAction(formData: FormData) {
  const published = String(formData.get("published") ?? "") === "on";
  if (published) return publishEventAction(formData);
  return unpublishEventAction(formData);
}
