import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { PhoneError, confirmPhoneVerification } from "@/lib/phone";

const select = {
  id: true, name: true, email: true, schoolDomain: true, classYear: true, bio: true,
  imageUrl: true, phone: true, phoneVerifiedAt: true,
};

/** `{ code }` → the number goes on the account. */
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const body = (await readJson(request)) as { code?: unknown } | null;
  try {
    await confirmPhoneVerification(user.id, String(body?.code ?? ""));
  } catch (error) {
    if (error instanceof PhoneError) return apiError(error.message, error.status);
    throw error;
  }
  const updated = await db.user.findUniqueOrThrow({ where: { id: user.id }, select });
  return json({ user: serializeUser(updated) });
}
