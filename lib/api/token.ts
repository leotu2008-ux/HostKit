import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bearer tokens for the iOS app.
 *
 * The web app signs in with Auth.js cookies, which a native client can't hold
 * onto sensibly. The API instead issues a small signed token:
 * base64url(JSON payload) + "." + base64url(HMAC-SHA256). The key is derived
 * from AUTH_SECRET with a prefix, so an API token can never be confused with
 * anything Auth.js signs.
 */

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type TokenPayload = {
  sub: string;
  exp: number;
  /** The account's session version when issued; a reset bumps it. */
  v: number;
  /** Milliseconds when issued. Absent on tokens from before revocation existed. */
  iat?: number;
};

function apiKey(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return `hostkit-api:${secret}`;
}

function signature(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function issueToken(
  userId: string,
  version = 0,
  now = Date.now(),
  key = apiKey(),
): string {
  const payload: TokenPayload = {
    sub: userId,
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
    v: version,
    iat: now,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body, key)}`;
}

/** The payload of a valid, unexpired token, or null for anything else. */
export function verifyToken(
  token: string,
  now = Date.now(),
  key = apiKey(),
): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, given] = parts;

  const expected = Buffer.from(signature(body, key));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<TokenPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 <= now) return null;
    // Tokens from before versions existed count as version 0.
    const v = typeof payload.v === "number" ? payload.v : 0;
    const iat = typeof payload.iat === "number" ? payload.iat : undefined;
    return iat === undefined
      ? { sub: payload.sub, exp: payload.exp, v }
      : { sub: payload.sub, exp: payload.exp, v, iat };
  } catch {
    return null;
  }
}

/**
 * When the token was issued, in milliseconds.
 *
 * New tokens carry `iat`. Older ones only have `exp`, which was `issued + TTL`,
 * so the issue time is recovered from that. Revocation compares this value.
 */
export function tokenIssuedAt(payload: TokenPayload): number {
  if (typeof payload.iat === "number") return payload.iat;
  return (payload.exp - TOKEN_TTL_SECONDS) * 1000;
}
