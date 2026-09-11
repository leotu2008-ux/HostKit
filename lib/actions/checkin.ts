"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";

export async function checkInGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  await db.guest.updateMany({
    where: { id: guestId, eventId },
    data: { checkedInAt: new Date(), rsvpStatus: "ATTENDING" },
  });
  refresh();
}

export async function undoCheckInAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  await db.guest.updateMany({
    where: { id: guestId, eventId },
    data: { checkedInAt: null },
  });
  refresh();
}
