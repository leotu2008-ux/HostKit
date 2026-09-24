"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { record } from "@/lib/activity";

/**
 * The door.
 *
 * Admitting someone must not touch their RSVP. It used to set
 * `rsvpStatus: "ATTENDING"` alongside the timestamp, which felt harmless and
 * quietly destroyed the only thing worth measuring: after the night there was
 * no way to tell a guest who said yes and came from one who never replied and
 * turned up anyway. Undo made it worse, clearing the timestamp and leaving the
 * invented "yes" behind.
 *
 * So the RSVP is left exactly as the guest set it, and the walk-up is recorded
 * separately, at the door, where it is known.
 */

export async function checkInGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  const guest = await db.guest.findFirst({
    where: { id: guestId, eventId },
    select: { id: true, name: true, rsvpStatus: true, checkedInAt: true },
  });
  // Already in: a second phone's stale tap must not move the arrival time or
  // re-derive the walk-up flag from an RSVP the host has since changed.
  if (!guest || guest.checkedInAt) return;

  await db.guest.update({
    where: { id: guest.id },
    data: {
      checkedInAt: new Date(),
      // Frozen now rather than derived later: rsvpStatus stays editable.
      arrivedWithoutRsvp: guest.rsvpStatus !== "ATTENDING",
    },
  });
  await record(eventId, { actor: "system", kind: "guest_checked_in", title: `${guest.name} checked in` });
  refresh();
}

export async function undoCheckInAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  await db.guest.updateMany({
    where: { id: guestId, eventId },
    // Undo has to undo everything the check-in wrote, or the next count is wrong.
    data: { checkedInAt: null, arrivedWithoutRsvp: false },
  });
  refresh();
}
