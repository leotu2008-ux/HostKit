"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { defaultStartHour, draftToDate, suggestRunSheet } from "@/lib/runsheet";

export type RunSheetFormState = { error?: string } | undefined;

/**
 * Builds the first draft from the event's actual bookings. Refuses to run
 * over an existing sheet: regenerating would silently discard edits the host
 * made, which is the one thing a run sheet must never do.
 */
export async function generateRunSheetAction(
  _prev: RunSheetFormState,
  formData: FormData,
): Promise<RunSheetFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  if (!event.date) {
    return { error: "Add a date to the event first — a run sheet needs one." };
  }

  const existing = await db.runSheetItem.count({ where: { eventId } });
  if (existing > 0) {
    return { error: "There's already a run sheet here. Clear it first if you want to start over." };
  }

  const booked = await db.inquiry.findMany({
    where: { eventId, status: "BOOKED" },
    include: { listing: { select: { name: true, category: true } } },
  });

  const drafts = suggestRunSheet(
    event,
    booked.map((i) => ({
      category: i.listing.category,
      name: i.listing.name,
    })),
  );

  const startHour = defaultStartHour(event.type);
  await db.runSheetItem.createMany({
    data: drafts.map((draft) => ({
      eventId,
      startsAt: draftToDate(event.date!, startHour, draft.offsetMinutes),
      title: draft.title,
      owner: draft.owner,
      notes: draft.notes,
    })),
  });

  refresh();
  return undefined;
}

const itemSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 18:30."),
  title: z.string().trim().min(1, "Give it a name."),
  owner: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function addRunSheetItemAction(
  _prev: RunSheetFormState,
  formData: FormData,
): Promise<RunSheetFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.date) return { error: "Add a date to the event first." };

  const parsed = itemSchema.safeParse({
    time: formData.get("time"),
    title: formData.get("title"),
    owner: formData.get("owner") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [hours, minutes] = parsed.data.time.split(":").map(Number);
  const startsAt = new Date(event.date);
  startsAt.setHours(hours, minutes, 0, 0);

  await db.runSheetItem.create({
    data: {
      eventId,
      startsAt,
      title: parsed.data.title,
      owner: parsed.data.owner || null,
      notes: parsed.data.notes || null,
      // A person wrote this one, so a future regenerate must leave it alone.
      source: "HUMAN",
    },
  });

  refresh();
  return undefined;
}

export async function removeRunSheetItemAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await requireEvent(eventId);

  await db.runSheetItem.deleteMany({ where: { id: itemId, eventId } });
  refresh();
}

export async function clearRunSheetAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEvent(eventId);

  await db.runSheetItem.deleteMany({ where: { eventId } });
  refresh();
}
