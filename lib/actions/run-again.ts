"use server";

import { redirect } from "next/navigation";
import { runEventAgain } from "@/lib/run-again";
import { requireEvent } from "@/lib/session";

const MIN_YEAR = 2000;
const MAX_YEARS_AHEAD = 5;

/**
 * Copies an event onto a new date and opens the copy. requireEvent also
 * admits club members and draft-claim holders, but running the series
 * forward is the host's call alone, so this refuses anyone else.
 */
export async function runAgainAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event, user } = await requireEvent(eventId);
  if (!event.ownerId || user?.id !== event.ownerId) redirect(`/events/${event.id}/run-again?error=owner`);
  const raw = String(formData.get("date") ?? "");
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) redirect(`/events/${event.id}/run-again?error=date`);

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + MAX_YEARS_AHEAD);
  if (date.getFullYear() < MIN_YEAR || date > maxDate) {
    redirect(`/events/${event.id}/run-again?error=date`);
  }

  const copyId = await runEventAgain(event.id, date);
  redirect(`/events/${copyId}`);
}
