import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { apiUser } from "@/lib/api/http";
import { verifyToken } from "@/lib/api/token";
import { SCOPES, tryMcpConfig, type McpOAuthConfig } from "@/lib/mcp/oauth-config";
import { authenticateMcp } from "@/lib/mcp/oauth";
import { createOAuthMcpServer, type McpActor } from "@/lib/mcp/oauth-tools";
import { createHostyMcpServer } from "@/lib/mcp/register";
import type { ToolContext } from "@/lib/mcp/tools";
import { RateLimitError, assertRateLimit } from "@/lib/rate-limit";

/**
 * Hosted MCP over streamable HTTP.
 *
 * One endpoint, two credentials:
 *
 * - An OAuth access token is 43 characters of base64url, issued by
 *   POST /api/oauth/token and stored only as a hash on McpGrant. When that
 *   grant is live, the request sees the OAuth tools (list_events,
 *   get_event_brief, search_venues).
 * - Every other bearer is the Hosty API token from POST /api/v1/auth/token.
 *   Those contain a dot, so they are not looked up as grants. They see
 *   list_events, get_event, list_guests, campus_events, and discover_events,
 *   still by calling /api/v1 with that same token.
 *
 * OAuth is optional. With MCP_PUBLIC_ORIGIN unset, only the bearer path
 * runs — that is what the Connect an agent page configures for Cursor.
 *
 * One stateless server per request: Vercel does not keep a process warm for
 * an SSE session, and Cursor treats a JSON response as a complete answer
 * (the client sends `Accept: application/json, text/event-stream` and reads
 * whichever the server picks). GET is 405 on purpose — the spec's way to
 * say there is no standing server-to-client stream. Cursor continues with
 * POST when it sees that.
 *
 * The bearer follow-up call uses `request.url`'s origin, not the Host header.
 * The bearer token is attached to that call, so a forged Host must not be able
 * to steer it.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

/** OAuth access tokens are 32 random bytes, base64url, with no dot. */
const OAUTH_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const BODY_LIMIT = 65_536;

const BEARER_ONLY =
  "Sign in with a Hosty bearer token. Get one from POST /api/v1/auth/token, or from the Connect an agent page while signed in.";

const BEARER_OR_OAUTH =
  "Sign in with a Hosty bearer token. Get one from POST /api/v1/auth/token, or from the Connect an agent page while signed in. Claude and ChatGPT can also connect with OAuth; follow the resource metadata on this response.";

export type McpSession = { token: string };

export type McpAuthenticate = (request: Request) => Promise<McpSession | null>;

/** The `Authorization: Bearer` value, or null when the header isn't one. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/**
 * The account behind an API bearer.
 *
 * `lookup` defaults to the v1 user check (signature, expiry, and the
 * session version a password reset bumps). Tests pass their own so a
 * rejected token can be asserted without a database.
 */
export async function authenticateMcpRequest(
  request: Request,
  lookup: (request: Request) => Promise<{ id: string } | null> = apiUser,
): Promise<McpSession | null> {
  const token = bearerToken(request);
  if (!token) return null;
  // A bad signature never needs a database round trip.
  if (!verifyToken(token)) return null;
  const user = await lookup(request);
  if (!user) return null;
  return { token };
}

/** Where this deployment's own `/api/v1` lives. */
export function deploymentOrigin(request: Request): string {
  return new URL(request.url).origin;
}

type Access =
  | { kind: "oauth"; actor: McpActor & { clientId: string } }
  | { kind: "bearer"; token: string }
  | { kind: "forbidden-origin" }
  | { kind: "anonymous" };

export async function handleMcpRequest(
  request: Request,
  options: {
    authenticate?: McpAuthenticate;
    /** Overrides the origin tools call. Tests point this at a stub. */
    baseUrl?: string;
    fetchImpl?: ToolContext["fetchImpl"];
  } = {},
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const oauth = tryMcpConfig();
  let access: Access;
  try {
    access = await resolveAccess(request, options.authenticate ?? authenticateMcpRequest, oauth);
  } catch (error) {
    console.error("hostkit mcp auth failed", error);
    return mcpError(500, "Hosty could not check that token.", oauth);
  }

  if (access.kind === "forbidden-origin") {
    return textResponse(403, "Forbidden origin");
  }
  if (access.kind === "anonymous") {
    return mcpError(401, oauth ? BEARER_OR_OAUTH : BEARER_ONLY, oauth);
  }

  // No standing SSE stream. Clients that only POST (Cursor, Claude) treat
  // 405 as "this server has nothing to push" and keep going.
  if (request.method === "GET") {
    return mcpError(405, "Hosty MCP accepts JSON-RPC on POST. It does not hold an SSE stream open.", oauth);
  }

  if (request.method !== "POST" && request.method !== "DELETE") {
    return mcpError(405, "Hosty MCP accepts POST and DELETE.", oauth);
  }

  if (access.kind === "oauth") {
    if (!oauth) return mcpError(500, "Hosty could not check that token.", null);
    return handleOAuthRequest(request, access.actor, oauth);
  }

  const baseUrl = (options.baseUrl ?? deploymentOrigin(request)).replace(/\/+$/, "");
  const server = createHostyMcpServer({
    baseUrl,
    token: access.token,
    fetchImpl: options.fetchImpl,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    console.error("hostkit mcp request failed", error);
    return mcpError(500, "Hosty MCP could not answer that request.", oauth);
  } finally {
    await server.close().catch(() => undefined);
  }
}

/**
 * OAuth grant first, then the API bearer.
 *
 * A foreign Origin is rejected only for an OAuth-shaped token. Cursor's
 * bearer config is not origin-gated, and neither is a request with no token.
 */
async function resolveAccess(
  request: Request,
  authenticate: McpAuthenticate,
  oauth: McpOAuthConfig | null,
): Promise<Access> {
  const token = bearerToken(request);
  if (oauth && token && OAUTH_TOKEN.test(token)) {
    const origin = request.headers.get("origin");
    if (origin && !originAllowed(origin, oauth)) return { kind: "forbidden-origin" };
    const actor = await authenticateMcp(request);
    if (actor) return { kind: "oauth", actor };
  }

  const session = await authenticate(request);
  if (!session) return { kind: "anonymous" };
  return { kind: "bearer", token: session.token };
}

function originAllowed(origin: string, oauth: McpOAuthConfig): boolean {
  const extra = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [oauth.origin, ...extra].includes(origin);
}

async function handleOAuthRequest(
  request: Request,
  actor: McpActor & { clientId: string },
  oauth: McpOAuthConfig,
): Promise<Response> {
  // This connector has no session to end. Bearer DELETE still reaches the SDK.
  if (request.method !== "POST") {
    return mcpError(405, "Hosty OAuth MCP accepts JSON-RPC on POST.", oauth);
  }

  try {
    await assertRateLimit(`mcp:requests:${actor.userId}`, 120, 60_000);
  } catch (error) {
    if (error instanceof RateLimitError) {
      const headers = corsHeaders();
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("Retry-After", "60");
      return new Response("Too many requests", { status: 429, headers });
    }
    console.error("hostkit mcp rate limit failed", error);
    return mcpError(500, "Hosty MCP could not answer that request.", oauth);
  }

  const body = await readBoundedJson(request);
  if (body instanceof Response) return body;

  const server = createOAuthMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody: body });
    response.headers.set("Cache-Control", "no-store");
    return withCors(response);
  } catch (error) {
    console.error("hostkit mcp request failed", error);
    return mcpError(500, "Hosty MCP could not answer that request.", oauth);
  } finally {
    await server.close().catch(() => undefined);
  }
}

/** Caps the OAuth body even when Content-Length is absent or inaccurate. */
async function readBoundedJson(request: Request): Promise<unknown | Response> {
  const reader = request.body?.getReader();
  if (!reader) return textResponse(400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > BODY_LIMIT) {
      await reader.cancel();
      return textResponse(413, "Request too large");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return textResponse(400, "Invalid JSON");
  }
}

function textResponse(status: number, message: string): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(message, { status, headers });
}

function corsHeaders(): Headers {
  const headers = new Headers(CORS);
  headers.set("Cache-Control", "no-store");
  return headers;
}

function wwwAuthenticate(oauth: McpOAuthConfig | null): string {
  if (!oauth) return 'Bearer realm="hosty"';
  const metadata = `${oauth.origin}/.well-known/oauth-protected-resource/api/mcp`;
  return `Bearer realm="hosty", resource_metadata="${metadata}", scope="${SCOPES.join(" ")}"`;
}

function mcpError(status: number, message: string, oauth: McpOAuthConfig | null): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "application/json");
  if (status === 401) headers.set("WWW-Authenticate", wwwAuthenticate(oauth));
  if (status === 405) headers.set("Allow", "POST, DELETE, OPTIONS");
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: status === 401 ? -32001 : status === 405 ? -32000 : -32603, message },
      id: null,
    }),
    { status, headers },
  );
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
