import { z } from "zod";
import { apiError, json, readJson } from "@/lib/api/http";
import { AccountError } from "@/lib/account";
import { joinEmailList } from "@/lib/email-list";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().max(128).optional(),
});

/**
 * Joins the email list and sends a confirmation. It does not create an
 * account — the administrator lets people in from /admin/waitlist
 * (lib/waitlist-approval.ts). A password, if an older
 * client still sends one, is ignored.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  }
  try {
    await assertRateLimit(`signup:ip:${clientIp(request.headers)}`, ...LIMITS.signUp.perIp);
    const { email } = await joinEmailList({ name: parsed.data.name, email: parsed.data.email });
    return json({ listed: true, email }, 200);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    if (error instanceof AccountError) return apiError(error.message, error.status);
    throw error;
  }
}
