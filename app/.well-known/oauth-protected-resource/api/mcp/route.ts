import { SCOPES, mcpConfig } from "@/lib/mcp/oauth-config";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const { origin, resource } = mcpConfig();
    return Response.json(
      {
        resource,
        authorization_servers: [origin],
        scopes_supported: SCOPES,
        bearer_methods_supported: ["header"],
        resource_name: "Hosty",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "MCP is not configured" }, { status: 503 });
  }
}
