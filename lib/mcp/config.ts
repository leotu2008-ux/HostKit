import { z } from "zod";

export const SCOPES = ["events:read", "venues:search"] as const;
const clientSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  secret: z.string().min(32).optional(),
  redirectUris: z.array(z.string().url()).min(1),
});

/** Explicit configuration, never derived from an untrusted Host header. */
export function mcpConfig() {
  const raw = process.env.MCP_PUBLIC_ORIGIN;
  if (!raw) throw new Error("MCP is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("MCP_PUBLIC_ORIGIN must use HTTPS");
  }
  if (raw !== url.origin) throw new Error("MCP_PUBLIC_ORIGIN must be an origin without a trailing slash");
  const clients = z.array(clientSchema).parse(JSON.parse(process.env.MCP_CLIENTS_JSON ?? "[]"));
  if (new Set(clients.map(c => c.id)).size !== clients.length) throw new Error("Duplicate MCP client IDs");
  for (const client of clients) for (const uri of client.redirectUris) {
    const redirect = new URL(uri);
    if (redirect.protocol !== "https:" || redirect.hash || redirect.username || redirect.password) {
      throw new Error("MCP redirect URIs must be exact HTTPS URLs without fragments or credentials");
    }
  }
  return { origin: url.origin, resource: `${url.origin}/api/mcp`, clients };
}

export const authorizationSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(200),
  redirect_uri: z.string().url(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(2048).optional(),
  scope: z.string().default(SCOPES.join(" ")),
  resource: z.string().url(),
});
export function authorizationRequest(input: unknown) {
  const params = authorizationSchema.parse(input);
  const config = mcpConfig();
  const client = config.clients.find(c => c.id === params.client_id);
  if (!client || !client.redirectUris.includes(params.redirect_uri)) throw new Error("Unregistered client or redirect URI");
  const scopes = [...new Set(params.scope.split(" ").filter(Boolean))];
  if (!scopes.length || scopes.some(s => !SCOPES.includes(s as typeof SCOPES[number]))) throw new Error("Unsupported scope");
  if (params.resource !== config.resource) throw new Error("Invalid resource");
  return { params, client, scopes, config };
}
