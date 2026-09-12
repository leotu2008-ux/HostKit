import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/api/token";
import { apiError, json, readJson } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// Same trick as lib/auth.ts: compare against a real hash even when the email
// is unknown, so response time doesn't reveal which addresses are registered.
const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.aG9RbG9KLMLLPk6f9CnXDGRwqW/G";

/** Exchanges an email and password for an API bearer token. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("Enter your email and password.", 400);
  }

  try {
    await assertRateLimit(`signin:ip:${clientIp(request.headers)}`, ...LIMITS.signIn.perIp);
    await assertRateLimit(`signin:email:${parsed.data.email}`, ...LIMITS.signIn.perEmail);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  const ok = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  if (!ok || !user) {
    return apiError("That email and password don't match.", 401);
  }

  return json({
    token: issueToken(user.id),
    user: serializeUser(user),
  });
}
