"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { arrivalClock, draftToDate, suggestRunSheet } from "@/lib/runsheet";
import { removableRunSheetRowWhere, runSheetRowsToReplace } from "@/lib/replan";

export type RunSheetFormState = { error?: string } | undefined;

/**
 * Builds a fresh draft from the event's current bookings and swaps it in for
 * whatever the app generated before, in one transaction. A row a host wrote
 * themselves is never in `remove`, so this is safe to run whether the sheet
 * is empty (the first draft) or full (a redraft) — same call either way.
 */
async function redraftRunSheet(event: {
  id: string;
  type: EventType;
  date: Date;
  durationHours: number;
}) {
  const [existing, booked] = await Promise.all([
    db.runSheetItem.findMany({ where: { eventId: event.id } }),
    db.inquiry.findMany({
      where: { eventId: event.id, status: "BOOKED" },
      include: { listing: { select: { name: true, category: true } } },
    }),
  ]);
  const { remove } = runSheetRowsToReplace(existing);

  const drafts = suggestRunSheet(
    event,
    booked.map((i) => ({
      category: i.listing.category,
      name: i.listing.name,
    })),
  );
  const { hour, minute } = arrivalClock(event.date, event.type);

  await db.$transaction(async (tx) => {
    // Re-checks source against current state rather than trusting the
    // snapshot `remove` was built from — see removableRunSheetRowWhere.
    await tx.runSheetItem.deleteMany({ where: removableRunSheetRowWhere(remove) });
    await tx.runSheetItem.createMany({
      data: drafts.map((draft) => ({
        eventId: event.id,
        startsAt: draftToDate(event.date, hour, draft.offsetMinutes, minute),
        title: draft.title,
        owner: draft.owner,
        notes: draft.notes,
        // Explicit, not relied on as the schema default — this is the whole
        // feature's second-use guarantee.
        source: "GENERATED" as const,
      })),
    });
  });
}

export async function generateRunSheetAction(
  _prev: RunSheetFormState,
  formData: FormData,
): Promise<RunSheetFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  if (!event.date) {
    return { error: "Add a date to the event first — a run sheet needs one." };
  }

  await redraftRunSheet({
    id: event.id,
    type: event.type,
    date: event.date,
    durationHours: event.durationHours,
  });

  refresh();
  return undefined;
}

/**
 * The redraft control on a populated run sheet. No FormState to thread back
 * through — the page it lives on only renders once a date exists, so there's
 * nothing here for a host to see go wrong.
 */
export async function regenerateRunSheetAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.date) return;

  await redraftRunSheet({
    id: event.id,
    type: event.type,
    date: event.date,
    durationHours: event.durationHours,
  });

  refresh();
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
