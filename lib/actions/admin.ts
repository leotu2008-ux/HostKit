"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { originFromHeaders } from "@/lib/mcp/config";
import { getCurrentUser } from "@/lib/session";
import { approveWaitlistEntry } from "@/lib/waitlist-approval";

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

/**
 * The administrator lets one waitlister in: creates or approves their account
 * and emails a set-password link (lib/waitlist-approval.ts). Public endpoint,
 * so the admin check is here.
 */
export async function approveWaitlistEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error("Only the administrator can approve people.");
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) throw new Error("No one to approve.");
  await approveWaitlistEntry(entryId, originFromHeaders(await headers()));
  refresh();
}
