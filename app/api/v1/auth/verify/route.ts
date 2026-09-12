import { db } from "@/lib/db";
import { apiError, apiUser, json } from "@/lib/api/http";
import { sendVerification, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit } from "@/lib/rate-limit";

/** Re-sends the verification link to the signed-in account's address. */
export async function POST(request: Request) {
  const me = await apiUser(request);
  if (!me) return apiError("Sign in first.", 401);
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  try {
    await assertRateLimit(`verify:user:${user.id}`, ...LIMITS.verify.perUser);
    const result = await sendVerification(user, siteOrigin(request.headers));
    return json({ ok: true, verified: Boolean(result.already), ...(result.devLink ? { devLink: result.devLink } : {}) });
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }
}
