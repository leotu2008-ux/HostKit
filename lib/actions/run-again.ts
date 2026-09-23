"use server";

import { redirect } from "next/navigation";
import { runEventAgain } from "@/lib/run-again";
import { requireEvent } from "@/lib/session";

/** Copies an event onto a new date and opens the copy. Public endpoint: requireEvent checks access. */
export async function runAgainAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.ownerId) redirect(`/events/${event.id}/run-again?error=owner`);
  const raw = String(formData.get("date") ?? "");
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) redirect(`/events/${event.id}/run-again?error=date`);
  const copyId = await runEventAgain(event.id, date);
  redirect(`/events/${copyId}`);
}
