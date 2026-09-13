import { z } from "zod";
import { apiError, json, readJson } from "@/lib/api/http";
import { resendVerificationTo, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

/** `{ email }` → another confirmation link, for someone who can't sign in
 *  yet. Always `{ ok: true }`, so it can't be used to check who has an account. */
export async function POST(request: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Enter your email address.", 400);
  try {
    await assertRateLimit(`resend:ip:${clientIp(request.headers)}`, ...LIMITS.resend.perIp);
    await assertRateLimit(`resend:email:${parsed.data.email}`, ...LIMITS.resend.perEmail);
    const { devLink } = await resendVerificationTo(parsed.data.email, siteOrigin(request.headers));
    return json({ ok: true, ...(devLink ? { devLink } : {}) });
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }
}
