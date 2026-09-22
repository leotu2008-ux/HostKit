import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { mcpConfig } from "./oauth-config";

export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export function secretMatches(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hashToken(a)), Buffer.from(hashToken(b)));
}

export function verifyPkce(verifier: string, challenge: string) {
  return (
    /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) &&
    secretMatches(createHash("sha256").update(verifier).digest("base64url"), challenge)
  );
}

/**
 * An OAuth access token for `/api/mcp`.
 *
 * These are 43-character base64url strings stored only as a SHA-256 hash on
 * McpGrant. Hosty API bearers contain a dot, so they never match and are
 * left for the bearer path in lib/mcp/http.ts.
 */
export async function authenticateMcp(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
  if (!bearer) return null;
  const config = mcpConfig();
  const grant = await db.mcpGrant.findUnique({
    where: { accessHash: hashToken(bearer) },
    include: { user: { select: { sessionVersion: true, emailVerifiedAt: true } } },
  });
  if (
    !grant ||
    grant.revokedAt ||
    !grant.accessExpiresAt ||
    grant.accessExpiresAt <= new Date() ||
    grant.expiresAt <= new Date() ||
    grant.resource !== config.resource ||
    grant.sessionVersion !== grant.user.sessionVersion ||
    !grant.user.emailVerifiedAt ||
    !config.clients.some((c) => c.id === grant.clientId)
  ) {
    return null;
  }
  return { userId: grant.userId, scopes: grant.scopes, clientId: grant.clientId };
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

/** Atomically consume a code or rotate a refresh token: concurrent replay can only win once. */
export async function exchangeToken(form: URLSearchParams, basic?: { id: string; secret: string }) {
  const config = mcpConfig();
  const id = basic?.id ?? form.get("client_id");
  const client = config.clients.find((c) => c.id === id);
  if (!client || (basic && form.has("client_id") && form.get("client_id") !== id)) {
    throw new OAuthError("invalid_client", 401);
  }
  if (client.secret) {
    if (!secretMatches(basic?.secret ?? form.get("client_secret") ?? "", client.secret)) {
      throw new OAuthError("invalid_client", 401);
    }
  } else if (basic || form.has("client_secret")) {
    throw new OAuthError("invalid_client", 401);
  }
  const resource = form.get("resource");
  if (resource && resource !== config.resource) throw new OAuthError("invalid_target");
  const type = form.get("grant_type");
  if (type !== "authorization_code" && type !== "refresh_token") throw new OAuthError("unsupported_grant_type");
  const raw = form.get(type === "authorization_code" ? "code" : "refresh_token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new OAuthError("invalid_grant");
  const lookup = type === "authorization_code" ? { codeHash: hashToken(raw) } : { refreshHash: hashToken(raw) };
  const grant = await db.mcpGrant.findUnique({
    where: lookup,
    include: { user: { select: { sessionVersion: true, emailVerifiedAt: true } } },
  });
  const now = new Date();
  if (
    !grant ||
    grant.clientId !== id ||
    grant.revokedAt ||
    grant.expiresAt <= now ||
    grant.resource !== config.resource ||
    !grant.user.emailVerifiedAt ||
    grant.sessionVersion !== grant.user.sessionVersion
  ) {
    throw new OAuthError("invalid_grant");
  }
  if (
    type === "authorization_code" &&
    (!grant.codeExpiresAt ||
      grant.codeExpiresAt <= now ||
      form.get("redirect_uri") !== grant.redirectUri ||
      !verifyPkce(form.get("code_verifier") ?? "", grant.codeChallenge))
  ) {
    throw new OAuthError("invalid_grant");
  }
  if (form.has("scope") && form.get("scope") !== grant.scopes.join(" ")) throw new OAuthError("invalid_scope");
  const access = randomToken();
  const refresh = randomToken();
  const expiresIn = Math.min(3600, Math.floor((grant.expiresAt.getTime() - now.getTime()) / 1000));
  if (expiresIn <= 0) throw new OAuthError("invalid_grant");
  const changed = await db.mcpGrant.updateMany({
    where: {
      id: grant.id,
      ...lookup,
      revokedAt: null,
      expiresAt: { gt: now },
      user: { sessionVersion: grant.sessionVersion },
    },
    data: {
      codeHash: null,
      codeExpiresAt: null,
      accessHash: hashToken(access),
      refreshHash: hashToken(refresh),
      accessExpiresAt: new Date(now.getTime() + expiresIn * 1000),
    },
  });
  if (changed.count !== 1) throw new OAuthError("invalid_grant");
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer" as const,
    expires_in: expiresIn,
    scope: grant.scopes.join(" "),
  };
}

export async function createAuthorizationCode(input: {
  userId: string;
  sessionVersion: number;
  clientId: string;
  resource: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
}) {
  const code = randomToken();
  await db.mcpGrant.create({
    data: {
      ...input,
      codeHash: hashToken(code),
      codeExpiresAt: new Date(Date.now() + 5 * 60_000),
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    },
  });
  return code;
}
