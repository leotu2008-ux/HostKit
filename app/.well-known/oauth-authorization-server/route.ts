import { mcpConfig, SCOPES } from "@/lib/mcp/config";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    const { origin } = mcpConfig();
    return Response.json({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/api/oauth/token`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"], scopes_supported: SCOPES }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "MCP is not configured" }, { status: 503 }); }
}
