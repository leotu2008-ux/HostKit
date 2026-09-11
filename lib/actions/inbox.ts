"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Opening the Inbox marks what's there as read. */
export async function markInboxReadAction() {
  const user = await requireUser("/inbox");
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}
