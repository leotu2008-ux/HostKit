import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { isPushConfigured } from "@/lib/push/apns";

const schema = z.object({ token: z.string().min(16).max(512), platform: z.string().max(16).optional() });

/** The iOS app registers its APNs device token here (only when its push
 *  entitlement is on). `pushEnabled` tells it whether the server can send. */
export async function PUT(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Send the device token.", 400);
  await db.pushToken.upsert({
    where: { token: parsed.data.token },
    create: { token: parsed.data.token, userId: user.id, platform: parsed.data.platform ?? "ios" },
    update: { userId: user.id, lastSeenAt: new Date() },
  });
  return json({ ok: true, pushEnabled: isPushConfigured() });
}

export async function DELETE(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Send the device token.", 400);
  await db.pushToken.deleteMany({ where: { token: parsed.data.token, userId: user.id } });
  return json({ ok: true });
}
