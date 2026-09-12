import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/api/token";
import { apiError, json, readJson } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { schoolDomainFor } from "@/lib/schools";
import { sendVerificationQuietly, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

// Same rules as the website's sign-up form (lib/actions/auth.ts).
const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

/** Creates an account and signs it in, in one step. A .edu address makes it
 *  a student account. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  }
  const { name, email, password } = parsed.data;
  try {
    await assertRateLimit(`signup:ip:${clientIp(request.headers)}`, ...LIMITS.signUp.perIp);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return apiError("That email is already registered. Try signing in.", 409);
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      schoolDomain: schoolDomainFor(email),
    },
  });

  await sendVerificationQuietly(user, siteOrigin(request.headers));
  return json({ token: issueToken(user.id), user: serializeUser(user) }, 201);
}
