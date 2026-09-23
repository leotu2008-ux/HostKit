import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AccountError, sendApprovalInvite } from "@/lib/account";
import { db } from "@/lib/db";

/**
 * The administrator lets one waitlist entry in. Deliberately not "use server"
 * (a "use server" export is a public endpoint): lib/actions/admin.ts wraps it
 * behind the admin check.
 *
 * Ordered to be retryable: user is created without approvedAt, the invite is sent,
 * and only after the send succeeds are user and entry marked approved. If the send
 * fails, the entry stays pending and "Let in" can retry; the next attempt finds the
 * user row created the first time and reuses it. If this call is the one that
 * created the user (there was no existing row) and the send then fails, that
 * half-made user is deleted before the error is rethrown — there is nothing yet
 * for a retry to reuse, so leaving it behind would just be a stray unapproved
 * account. A user row that already existed is never deleted.
 */
export async function approveWaitlistEntry(
  entryId: string,
  origin: string,
): Promise<{ email: string; alreadyApproved: boolean }> {
  const entry = await db.emailListEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new AccountError("That person is not on the waitlist.", 404);
  if (entry.approvedAt) return { email: entry.email, alreadyApproved: true };

  const existing = await db.user.findUnique({ where: { email: entry.email } });
  const user = existing
    ? existing
    : await db.user.create({
        data: {
          email: entry.email,
          name: entry.name,
          // Unusable until the invite link sets a real one.
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        },
      });

  // If this throws, the entry stays pending and can be retried. When this
  // call is the one that created the user, undo that too — otherwise a
  // failed send leaves an unapproved account nobody asked for and a retry
  // can't tell it apart from one made by a real signup.
  try {
    await sendApprovalInvite({ id: user.id, email: user.email, name: user.name }, origin);
  } catch (error) {
    if (!existing) await db.user.delete({ where: { id: user.id } });
    throw error;
  }

  // Only after the send succeeds.
  const now = new Date();
  await db.user.update({ where: { id: user.id }, data: { approvedAt: now } });
  await db.emailListEntry.update({ where: { id: entry.id }, data: { approvedAt: now, userId: user.id } });
  return { email: entry.email, alreadyApproved: false };
}
