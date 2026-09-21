import { db } from "@/lib/db";
import { isEmailConfigured, sendEmails } from "@/lib/email/send";
import { isPushConfigured, sendPush } from "@/lib/push/apns";

/**
 * One call to tell people something. Always lands in their Inbox; goes
 * out by email for the kinds worth an email when Resend is configured;
 * goes out by push to every registered device when APNs is configured.
 * Nothing here can fail the action that triggered it.
 */

export type NotificationKind =
  | "club_published"
  | "club_update"
  | "registration_request"
  | "registration_approved"
  | "waitlist_promoted"
  | "blast"
  | "agent_briefing";

const EMAIL_KINDS = new Set<NotificationKind>([
  "club_published",
  "club_update",
  "registration_approved",
  "waitlist_promoted",
  "agent_briefing",
]);

export type Notice = {
  kind: NotificationKind;
  title: string;
  body: string;
  eventId?: string | null;
  clubId?: string | null;
};

export async function notify(userIds: string[], notice: Notice): Promise<number> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return 0;

  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      kind: notice.kind,
      title: notice.title,
      body: notice.body,
      eventId: notice.eventId ?? null,
      clubId: notice.clubId ?? null,
    })),
  });

  try {
    if (EMAIL_KINDS.has(notice.kind) && isEmailConfigured()) {
      const users = await db.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
      await sendEmails(users.map((u) => ({ to: u.email, subject: notice.title, text: notice.body })));
    }
  } catch (error) {
    console.error("[notify] email failed", error);
  }

  try {
    if (isPushConfigured()) {
      const [tokens, unread] = await Promise.all([
        db.pushToken.findMany({ where: { userId: { in: ids } }, select: { token: true, userId: true } }),
        db.notification.groupBy({ by: ["userId"], where: { userId: { in: ids }, readAt: null }, _count: true }),
      ]);
      const badgeFor = new Map(unread.map((u) => [u.userId, u._count]));
      const dead = await sendPush(
        tokens.map((t) => ({
          token: t.token,
          title: notice.title,
          body: notice.body,
          badge: badgeFor.get(t.userId) ?? 1,
          data: { eventId: notice.eventId ?? null, clubId: notice.clubId ?? null },
        })),
      );
      if (dead.length > 0) await db.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
  } catch (error) {
    console.error("[notify] push failed", error);
  }

  return ids.length;
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}
