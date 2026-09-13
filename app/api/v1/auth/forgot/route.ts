import { z } from "zod";
import { apiError, json, readJson } from "@/lib/api/http";
import { requestPasswordReset, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

/** `{ email }` → a reset link by email. Always `{ ok: true }`, so the
 *  endpoint can't be used to check who has an account. */
export async function POST(request: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Enter your email address.", 400);
  try {
    await assertRateLimit(`forgot:ip:${clientIp(request.headers)}`, ...LIMITS.forgot.perIp);
    await assertRateLimit(`forgot:email:${parsed.data.email}`, ...LIMITS.forgot.perEmail);
    const { devLink } = await requestPasswordReset(parsed.data.email, siteOrigin(request.headers));
    return json({ ok: true, ...(devLink ? { devLink } : {}) });
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }
}
