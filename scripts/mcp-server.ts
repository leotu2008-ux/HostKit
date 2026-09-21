#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, HostKitApiError, type ToolContext } from "../lib/mcp/tools";

/**
 * HostKit as an MCP server, over stdio.
 *
 * Runs beside the app rather than inside it, holding nothing but a base URL
 * and a bearer token. Everything it can see is what that token's owner can
 * see, because every call goes through the same v1 routes the iOS client uses.
 *
 *   HOSTKIT_URL=https://host-kit-one.vercel.app \
 *   HOSTKIT_TOKEN=... \
 *   npx tsx scripts/mcp-server.ts
 *
 * Get a token with:
 *   curl -X POST "$HOSTKIT_URL/api/v1/auth/token" \
 *     -H 'content-type: application/json' \
 *     -d '{"email":"you@school.edu","password":"..."}'
 */

const baseUrl = process.env.HOSTKIT_URL?.trim();
const token = process.env.HOSTKIT_TOKEN?.trim();

if (!baseUrl || !token) {
  // stderr, never stdout: stdout is the protocol channel and anything else
  // written there corrupts the stream.
  console.error(
    "HOSTKIT_URL and HOSTKIT_TOKEN are both required.\n" +
      "Get a token from POST $HOSTKIT_URL/api/v1/auth/token with your email and password.",
  );
  process.exit(1);
}

const ctx: ToolContext = { baseUrl, token };

const server = new McpServer({ name: "hostkit", version: "0.1.0" });

for (const tool of TOOLS) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: (tool.schema as unknown as { shape: Record<string, never> }).shape,
      annotations: { readOnlyHint: tool.readOnly, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        const result = await tool.run(ctx, args ?? {});
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        // Hand back the reason rather than throwing: a caller can act on
        // "your token expired" and can do nothing with a stack trace.
        const message =
          error instanceof HostKitApiError
            ? error.message
            : `Could not reach HostKit at ${baseUrl}. ${error instanceof Error ? error.message : String(error)}`;
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    },
  );
}

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`hostkit mcp ready — ${TOOLS.length} tools against ${baseUrl}`);
}

main().catch((error) => {
  console.error("hostkit mcp failed to start", error);
  process.exit(1);
});
