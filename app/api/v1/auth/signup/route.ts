import { z } from "zod";
import { apiError, json, readJson } from "@/lib/api/http";
import { AccountError, createAccountPendingVerification, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

// Same rules as the website's sign-up form (lib/actions/auth.ts).
const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
});

/**
 * Creates an account. A .edu address makes it a student account. Answers
 * 202 `{ pending: true, email }`: the account can't sign in until the link
 * in the confirmation email is opened (`devLink` comes back only without an
 * email service, outside production). Nothing is kept if that email can't
 * be sent — see createAccountPendingVerification.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  }
  try {
    await assertRateLimit(`signup:ip:${clientIp(request.headers)}`, ...LIMITS.signUp.perIp);
    const { email, devLink } = await createAccountPendingVerification({
      ...parsed.data,
      origin: siteOrigin(request.headers),
    });
    return json({ pending: true, email, ...(devLink ? { devLink } : {}) }, 202);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    if (error instanceof AccountError) return apiError(error.message, error.status);
    throw error;
  }
}
