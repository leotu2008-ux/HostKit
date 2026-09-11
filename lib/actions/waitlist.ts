"use server";

import { refresh } from "next/cache";
import { requireEvent } from "@/lib/session";
import { decideRequest, promoteWaitlist } from "@/lib/waitlist";

/** The host approves or declines a request from the dashboard. */
export async function decideRequestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  const approve = String(formData.get("decision") ?? "") === "approve";
  const { event } = await requireEvent(eventId);
  await decideRequest(event.id, guestId, approve);
  // Declining a pending request doesn't free a seat, but approving into a
  // full event followed by a cancellation might have; keep the line moving.
  await promoteWaitlist(event.id);
  refresh();
}
