import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpConfig, SCOPES } from "@/lib/mcp/config";
import { authenticateMcp } from "@/lib/mcp/oauth";
import { createMcpServer } from "@/lib/mcp/tools";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let config;
  try { config = mcpConfig(); } catch { return Response.json({ error: "MCP is not configured" }, { status: 503 }); }
  const origin = request.headers.get("origin");
  const allowed = [config.origin, ...(process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)];
  if (origin && !allowed.includes(origin)) return new Response("Forbidden origin", { status: 403 });
  const actor = await authenticateMcp(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401, headers: {
    "WWW-Authenticate": `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/api/mcp", scope="${SCOPES.join(" ")}"`, "Cache-Control": "no-store",
  } });
  try { await assertRateLimit(`mcp:requests:${actor.userId}`, 120, 60_000); }
  catch (e) { if (e instanceof RateLimitError) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } }); throw e; }
  // Bound the body even when Content-Length is absent or inaccurate.
  const reader = request.body?.getReader();
  if (!reader) return new Response("JSON body required", { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 65536) { await reader.cancel(); return new Response("Request too large", { status: 413 }); }
    chunks.push(value);
  }
  let parsedBody;
  try { parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return new Response("Invalid JSON", { status: 400 }); }
  const server = createMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally { await server.close(); }
}
// This stateless connector doesn't offer an unsolicited SSE stream or sessions.
export function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export const DELETE = GET;
