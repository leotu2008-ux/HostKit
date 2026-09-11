import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { PhoneError, removePhone, startPhoneVerification } from "@/lib/phone";

const select = {
  id: true, name: true, email: true, schoolDomain: true, classYear: true, bio: true,
  imageUrl: true, phone: true, phoneVerifiedAt: true,
};

/** `{ phone }` → texts a code. Returns `devCode` only without SMS, outside production. */
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const body = (await readJson(request)) as { phone?: unknown } | null;
  try {
    const started = await startPhoneVerification(user.id, String(body?.phone ?? ""));
    return json({ phone: started.phone, expiresAt: started.expiresAt.toISOString(), devCode: started.devCode ?? null });
  } catch (error) {
    if (error instanceof PhoneError) return apiError(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  await removePhone(user.id);
  const updated = await db.user.findUniqueOrThrow({ where: { id: user.id }, select });
  return json({ user: serializeUser(updated) });
}
