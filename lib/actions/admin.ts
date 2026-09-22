"use server";

import { refresh } from "next/cache";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * The administrator removes any event, whoever owns it. Deleting cascades to
 * its guests, collaborators, outreach and activity.
 *
 * A "use server" export is a public endpoint, so the admin check lives here,
 * not only on the page that renders the button.
 */
export async function deleteEventAsAdminAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error("Only the administrator can remove events.");
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) throw new Error("No event to remove.");
  await db.event.delete({ where: { id: eventId } });
  refresh();
}
