import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";

const schema = z.object({ ids: z.array(z.string().min(1)).max(200).optional() });

/** `{ ids? }` → marks those (or everything) read. Returns the new unread count. */
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const parsed = schema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return apiError("Send ids, or nothing for all.", 400);
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}) },
    data: { readAt: new Date() },
  });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return json({ ok: true, unread });
}
