import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { TOKEN_TTL_SECONDS, tokenIssuedAt, type TokenPayload } from "@/lib/api/token";

/**
 * Cutoff for HMAC bearer tokens (the iOS app and the Cursor MCP token).
 *
 * Those tokens are stateless. `AccountToken.kind` is a free string, so a row
 * of kind `agent-revoke` records "reject anything issued at or before
 * `usedAt`" without a schema change. `usedAt` is the application clock, not
 * the database default, so a token issued a moment later compares cleanly.
 * The marker outlives the 30-day token TTL; after that every pre-revoke
 * token is expired anyway.
 *
 * Web sessions are Auth.js cookies checked against `sessionVersion`, so this
 * does not sign the browser out. A password reset still bumps
 * `sessionVersion`, which rejects bearer tokens on its own.
 */

export const AGENT_REVOKE_KIND = "agent-revoke";

/** Two days past the bearer TTL, so a marker never lapses while a token it
 *  was meant to kill is still inside its expiry window. */
export const AGENT_REVOKE_TTL_MS = (TOKEN_TTL_SECONDS + 2 * 24 * 60 * 60) * 1000;

/** True when this payload was issued at or before the cutoff. No cutoff means
 *  the token is still allowed (signature and session version are separate). */
export function bearerRevoked(payload: TokenPayload, revokedAt: Date | null): boolean {
  if (!revokedAt) return false;
  return tokenIssuedAt(payload) <= revokedAt.getTime();
}

/** The live cutoff for this account, or null when agent access has not been revoked. */
export async function agentRevokedAt(userId: string, now = Date.now()): Promise<Date | null> {
  const row = await db.accountToken.findFirst({
    where: { userId, kind: AGENT_REVOKE_KIND, expiresAt: { gt: new Date(now) } },
    orderBy: { createdAt: "desc" },
    select: { usedAt: true },
  });
  if (!row) return null;
  // A marker without a cutoff still means revoke. Refuse every bearer.
  return row.usedAt ?? new Date(now);
}

/** Invalidates bearer tokens issued at or before this moment. */
export async function revokeAgentTokens(userId: string, now = Date.now()): Promise<Date> {
  const revokedAt = new Date(now);
  await db.$transaction([
    db.accountToken.deleteMany({ where: { userId, kind: AGENT_REVOKE_KIND } }),
    db.accountToken.create({
      data: {
        userId,
        kind: AGENT_REVOKE_KIND,
        tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        expiresAt: new Date(now + AGENT_REVOKE_TTL_MS),
        usedAt: revokedAt,
      },
    }),
  ]);
  return revokedAt;
}
