import { db } from "@/lib/db";

/**
 * Fixed-window rate limits for the endpoints that guess at credentials:
 * sign-in, sign-up, forgot-password, resend-verification. Counters live in
 * Postgres (`RateLimit`) because serverless instances share no memory.
 *
 * `assertRateLimit("signin:ip:1.2.3.4", 20, 15 * 60_000)` counts one hit
 * and throws RateLimitError once the window's limit is passed.
 */

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(message = "Too many attempts. Give it a few minutes.") {
    super(message);
  }
}

export async function assertRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date();
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return;
  }
  if (row.count >= limit) throw new RateLimitError();
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
}

/** Old windows are noise; the auth routes call this now and then. */
export async function sweepRateLimits(olderThanMs = 24 * 60 * 60_000): Promise<void> {
  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - olderThanMs) } } });
}

/** The caller's address behind Vercel's proxy, or "local" when there is none. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "";
  return forwarded.split(",")[0]?.trim() || "local";
}

/** Limits, in one place, so the web actions and API routes agree. */
export const LIMITS = {
  signIn: { perIp: [30, 15 * 60_000], perEmail: [10, 15 * 60_000] },
  signUp: { perIp: [10, 60 * 60_000] },
  forgot: { perIp: [10, 60 * 60_000], perEmail: [3, 60 * 60_000] },
  verify: { perUser: [3, 60 * 60_000] },
} as const satisfies Record<string, Record<string, readonly [number, number]>>;
