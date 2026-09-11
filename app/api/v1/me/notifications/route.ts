import { db } from "@/lib/db";
import { apiError, apiUser, json } from "@/lib/api/http";
import { unreadCount } from "@/lib/notify";

/** The Inbox: newest first, with the unread count for the badge. */
export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    unreadCount(user.id),
  ]);
  return json({
    items: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      eventId: n.eventId,
      clubId: n.clubId,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  });
}
