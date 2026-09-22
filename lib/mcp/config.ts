/**
 * Addresses and config snippets for the hosted MCP.
 *
 * Kept apart from the server so the install page can render them without
 * pulling the MCP SDK — or the OAuth config in lib/mcp/oauth-config.ts —
 * into the browser bundle.
 */

export const MCP_PATH = "/api/mcp";

/** The production address people paste into Cursor and Claude. */
export const PRODUCTION_MCP_URL = `https://tryhosty.app${MCP_PATH}`;

/** The origin a browser request actually arrived on, for preview deployments. */
export function originFromHeaders(headers: Headers): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "tryhosty.app")
    .split(",")[0]
    .trim();
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = forwarded || (local ? "http" : "https");
  return `${proto}://${host}`;
}

export function mcpUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${MCP_PATH}`;
}

/** Cursor's remote MCP config. `type` is omitted; Cursor infers streamable HTTP from `url`. */
export function cursorMcpConfig(url: string, token = "YOUR_TOKEN"): string {
  return JSON.stringify(
    {
      mcpServers: {
        hostkit: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

/** Claude Desktop's remote MCP config. It wants an explicit HTTP transport. */
export function claudeMcpConfig(url: string, token = "YOUR_TOKEN"): string {
  return JSON.stringify(
    {
      mcpServers: {
        hostkit: {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}
