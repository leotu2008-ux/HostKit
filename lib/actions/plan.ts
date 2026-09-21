"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireEvent } from "@/lib/session";
import { briefIsComplete } from "@/lib/brief";
import { regenerateTasksAndCategories } from "@/lib/replan-apply";

/**
 * A blank or half-finished brief has no real facts to draft a plan from —
 * MIXER/$0/no-date isn't a plan, it's the schema defaults. So a redraft is
 * refused until the brief is complete, and the host is sent to fill it in:
 * planting a plan built from the schema defaults would put a budget split and
 * a timeline in front of them that describe an event nobody has described yet.
 * The agent reaches the same writer (lib/replan-apply.ts) with a brief it has
 * actually read.
 */
export async function regeneratePlanAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  if (!briefIsComplete(event)) {
    redirect(`/events/${eventId}/brief`);
  }

  await regenerateTasksAndCategories(eventId, {
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
  });

  refresh();
}
