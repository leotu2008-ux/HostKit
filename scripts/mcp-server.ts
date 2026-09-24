#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHostyMcpServer } from "../lib/mcp/register";
import { TOOLS, type ToolContext } from "../lib/mcp/tools";

/**
 * Hosty as an MCP server, over stdio.
 *
 * Runs beside the app rather than inside it, holding nothing but a base URL
 * and a bearer token. Everything it can see is what that token's owner can
 * see, because every call goes through the same v1 routes the iOS client uses.
 *
 *   HOSTY_URL=https://tryhosty.app \
 *   HOSTY_TOKEN=... \
 *   npx tsx scripts/mcp-server.ts
 *
 * Get a token with:
 *   curl -X POST "$HOSTY_URL/api/v1/auth/token" \
 *     -H 'content-type: application/json' \
 *     -d '{"email":"you@school.edu","password":"..."}'
 *
 * The hosted equivalent is POST /api/mcp on the same origin — see /mcp.
 */

// HOSTKIT_* are the names before the rebrand, still read so an existing setup keeps working.
const baseUrl = (process.env.HOSTY_URL ?? process.env.HOSTKIT_URL)?.trim();
const token = (process.env.HOSTY_TOKEN ?? process.env.HOSTKIT_TOKEN)?.trim();

if (!baseUrl || !token) {
  // stderr, never stdout: stdout is the protocol channel and anything else
  // written there corrupts the stream.
  console.error(
    "HOSTY_URL and HOSTY_TOKEN are both required.\n" +
      "Get a token from POST $HOSTY_URL/api/v1/auth/token with your email and password.",
  );
  process.exit(1);
}

const ctx: ToolContext = { baseUrl, token };
const server = createHostyMcpServer(ctx);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`hosty mcp ready — ${TOOLS.length} tools against ${baseUrl}`);
}

main().catch((error) => {
  console.error("hosty mcp failed to start", error);
  process.exit(1);
});
