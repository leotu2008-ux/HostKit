import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AccountError, sendApprovalInvite } from "@/lib/account";
import { db } from "@/lib/db";

/**
 * The administrator lets one waitlist entry in. Deliberately not "use server"
 * (a "use server" export is a public endpoint): lib/actions/admin.ts wraps it
 * behind the admin check.
 *
 * Idempotent: an entry that's already approved sends nothing and changes
 * nothing, so a double click can't mail two invites.
 */
export async function approveWaitlistEntry(
  entryId: string,
  origin: string,
): Promise<{ email: string; alreadyApproved: boolean }> {
  const entry = await db.emailListEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new AccountError("That person is not on the waitlist.", 404);
  if (entry.approvedAt) return { email: entry.email, alreadyApproved: true };

  const now = new Date();
  const existing = await db.user.findUnique({ where: { email: entry.email } });
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { approvedAt: now } })
    : await db.user.create({
        data: {
          email: entry.email,
          name: entry.name,
          // Unusable until the invite link sets a real one.
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
          approvedAt: now,
        },
      });

  await db.emailListEntry.update({ where: { id: entry.id }, data: { approvedAt: now, userId: user.id } });
  await sendApprovalInvite({ id: user.id, email: user.email, name: user.name }, origin);
  return { email: entry.email, alreadyApproved: false };
}
