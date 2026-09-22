import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { apiUser } from "@/lib/api/http";
import { verifyToken } from "@/lib/api/token";
import { createHostKitMcpServer } from "@/lib/mcp/register";
import type { ToolContext } from "@/lib/mcp/tools";

/**
 * Hosted MCP over streamable HTTP.
 *
 * One stateless server per request: Vercel does not keep a process warm for
 * an SSE session, and Cursor treats a JSON response as a complete answer
 * (the client sends `Accept: application/json, text/event-stream` and reads
 * whichever the server picks). GET is 405 on purpose — the spec's way to
 * say there is no standing server-to-client stream. Cursor continues with
 * POST when it sees that.
 *
 * The follow-up call uses `request.url`'s origin, not the Host header. The
 * bearer token is attached to that call, so a forged Host must not be able
 * to steer it.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export type McpSession = { token: string };

export type McpAuthenticate = (request: Request) => Promise<McpSession | null>;

/** The `Authorization: Bearer` value, or null when the header isn't one. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/**
 * The account behind the request.
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

  const authenticate = options.authenticate ?? authenticateMcpRequest;
  let session: McpSession | null;
  try {
    session = await authenticate(request);
  } catch (error) {
    console.error("hostkit mcp auth failed", error);
    return mcpError(500, "HostKit could not check that token.");
  }
  if (!session) {
    return mcpError(
      401,
      "Sign in with a HostKit bearer token. Get one from POST /api/v1/auth/token, or from the Connect an agent page while signed in.",
    );
  }

  // No standing SSE stream. Clients that only POST (Cursor, Claude) treat
  // 405 as "this server has nothing to push" and keep going.
  if (request.method === "GET") {
    return mcpError(405, "HostKit MCP accepts JSON-RPC on POST. It does not hold an SSE stream open.");
  }

  if (request.method !== "POST" && request.method !== "DELETE") {
    return mcpError(405, "HostKit MCP accepts POST and DELETE.");
  }

  const baseUrl = (options.baseUrl ?? deploymentOrigin(request)).replace(/\/+$/, "");
  const server = createHostKitMcpServer({
    baseUrl,
    token: session.token,
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
    return mcpError(500, "HostKit MCP could not answer that request.");
  } finally {
    await server.close().catch(() => undefined);
  }
}

function corsHeaders(): Headers {
  const headers = new Headers(CORS);
  headers.set("Cache-Control", "no-store");
  return headers;
}

function mcpError(status: number, message: string): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "application/json");
  if (status === 401) headers.set("WWW-Authenticate", 'Bearer realm="hostkit"');
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
