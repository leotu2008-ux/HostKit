import { handleMcpRequest } from "@/lib/mcp/http";

/**
 * Remote MCP for Cursor, Claude, and ChatGPT.
 *
 *   POST https://tryhosty.app/api/mcp
 *
 * Two credentials, one URL:
 * - Authorization: Bearer <token from POST /api/v1/auth/token> — the Cursor
 *   install on /mcp. Tools in lib/mcp/tools.ts.
 * - Authorization: Bearer <OAuth access token from POST /api/oauth/token> —
 *   Claude and ChatGPT after consent. Tools in lib/mcp/oauth-tools.ts.
 *
 * A grant is tried first. Anything that is not a live OAuth token falls
 * through to the API bearer. With OAuth unset, only the bearer path runs.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function respond(request: Request) {
  return handleMcpRequest(request);
}

export function GET(request: Request) {
  return respond(request);
}

export function POST(request: Request) {
  return respond(request);
}

export function DELETE(request: Request) {
  return respond(request);
}

export function OPTIONS(request: Request) {
  return respond(request);
}
