import { handleMcpRequest } from "@/lib/mcp/http";

/**
 * Remote MCP for Cursor and Claude.
 *
 *   POST https://tryhosty.app/api/mcp
 *   Authorization: Bearer <token from POST /api/v1/auth/token>
 *
 * Stateless, read-only, and scoped to that token's user. The tools are the
 * ones in lib/mcp/tools.ts — this route is only the transport and the gate.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
