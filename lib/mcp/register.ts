import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HostyApiError, TOOLS, type ToolContext } from "./tools";

const INSTRUCTIONS =
  "Read-only access to the Hosty account that issued the bearer token. " +
  "You can list and inspect events, guest lists, campus calendars and public discovery. " +
  "You cannot publish, message guests, check anyone in, or change an event.";

/**
 * The same five tools the stdio server exposes, bound to one account's token.
 * Both transports call this so a tool cannot exist on one and not the other.
 */
export function createHostyMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "hosty", version: "0.1.0" }, { instructions: INSTRUCTIONS });

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
            error instanceof HostyApiError
              ? error.message
              : `Could not reach Hosty at ${ctx.baseUrl}. ${error instanceof Error ? error.message : String(error)}`;
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }

  return server;
}
