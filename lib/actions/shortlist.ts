"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";

export async function toggleSavedAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await requireEvent(eventId);

  const existing = await db.savedListing.findUnique({
    where: { eventId_listingId: { eventId, listingId } },
  });

  if (existing) {
    await db.savedListing.delete({ where: { id: existing.id } });
  } else {
    await db.savedListing.create({ data: { eventId, listingId } });
  }
  refresh();
}

export async function setShortlistNoteAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  await requireEvent(eventId);

  await db.savedListing.update({
    where: { eventId_listingId: { eventId, listingId } },
    data: { note: note || null },
  });
  refresh();
}
