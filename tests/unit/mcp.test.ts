import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const mocks = vi.hoisted(() => ({ findGrant: vi.fn(), updateGrant: vi.fn(), findEvent: vi.fn(), listEvents: vi.fn(), search: vi.fn(), limit: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { mcpGrant: { findUnique: mocks.findGrant, updateMany: mocks.updateGrant }, event: { findFirst: mocks.findEvent, findMany: mocks.listEvents } } }));
vi.mock("@/lib/venues/search", () => ({ searchVenues: mocks.search, venueSearchProvider: mocks.provider }));
vi.mock("@/lib/rate-limit", () => ({ assertRateLimit: mocks.limit, clientIp: () => "test", RateLimitError: class extends Error {} }));
import { authorizationRequest, mcpConfig } from "@/lib/mcp/config";
import { authenticateMcp, exchangeToken, hashToken, verifyPkce } from "@/lib/mcp/oauth";
import { createMcpServer, eventAccess } from "@/lib/mcp/tools";
import { POST } from "@/app/api/mcp/route";

const origin = "https://hostkit.example";
const verifier = "x".repeat(43);
const code = "c".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authParams = { response_type: "code", client_id: "claude", redirect_uri: "https://client.example/callback", code_challenge: challenge, code_challenge_method: "S256", resource: `${origin}/api/mcp`, scope: "events:read venues:search", state: "state" };
const grant = () => ({ id: "grant-1", userId: "user-1", clientId: "claude", resource: `${origin}/api/mcp`, redirectUri: authParams.redirect_uri, codeChallenge: challenge, scopes: ["events:read", "venues:search"], codeHash: hashToken(code), codeExpiresAt: new Date(Date.now() + 300000), accessExpiresAt: new Date(Date.now() + 3600000), expiresAt: new Date(Date.now() + 86400000), revokedAt: null, sessionVersion: 2, user: { sessionVersion: 2, emailVerifiedAt: new Date() } });
const tokenForm = () => new URLSearchParams({ grant_type: "authorization_code", client_id: "claude", code, code_verifier: verifier, redirect_uri: authParams.redirect_uri, resource: authParams.resource });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MCP_PUBLIC_ORIGIN", origin);
  vi.stubEnv("MCP_CLIENTS_JSON", JSON.stringify([{ id: "claude", name: "Claude", redirectUris: [authParams.redirect_uri] }]));
  mocks.findGrant.mockResolvedValue(grant()); mocks.updateGrant.mockResolvedValue({ count: 1 }); mocks.provider.mockReturnValue("google"); mocks.limit.mockResolvedValue(undefined);
});

describe("OAuth boundaries", () => {
  it("accepts registered redirects and S256 only", () => {
    expect(authorizationRequest(authParams).scopes).toEqual(["events:read", "venues:search"]);
    for (const bad of [{ redirect_uri: "https://client.example/callback/other" }, { redirect_uri: "https://evil.example" }, { client_id: "other" }, { resource: "https://other.example/api/mcp" }, { scope: "events:write" }, { code_challenge_method: "plain" }]) expect(() => authorizationRequest({ ...authParams, ...bad })).toThrow();
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce("y".repeat(43), challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
  });
  it("rejects insecure production configuration", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("MCP_PUBLIC_ORIGIN", "http://localhost:3000");
    expect(() => mcpConfig()).toThrow(); vi.unstubAllEnvs();
  });
  it("exchanges a code and stores only credential hashes", async () => {
    const tokens = await exchangeToken(tokenForm());
    expect(tokens.expires_in).toBe(3600);
    const call = mocks.updateGrant.mock.calls[0][0];
    expect(call.where.codeHash).toBe(hashToken(code));
    expect(call.data.codeHash).toBeNull();
    expect(call.data.accessHash).toBe(hashToken(tokens.access_token));
    expect(call.data.refreshHash).toBe(hashToken(tokens.refresh_token));
    expect(JSON.stringify(call)).not.toContain(tokens.access_token);
  });
  it("rejects concurrent code replay when atomic consumption loses", async () => {
    mocks.updateGrant.mockResolvedValue({ count: 0 });
    await expect(exchangeToken(tokenForm())).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("rejects wrong PKCE, redirect, client, resource and expired grants", async () => {
    for (const [key, value] of [["code_verifier", "y".repeat(43)], ["redirect_uri", "https://evil.example"], ["client_id", "other"], ["resource", "https://evil.example/api/mcp"]]) {
      const form = tokenForm(); form.set(key, value); await expect(exchangeToken(form)).rejects.toThrow();
    }
    mocks.findGrant.mockResolvedValue({ ...grant(), codeExpiresAt: new Date(0) });
    await expect(exchangeToken(tokenForm())).rejects.toThrow();
    expect(mocks.updateGrant).not.toHaveBeenCalled();
  });
  it("requires configured client credentials", async () => {
    vi.stubEnv("MCP_CLIENTS_JSON", JSON.stringify([{ id: "claude", name: "Claude", secret: "s".repeat(32), redirectUris: [authParams.redirect_uri] }]));
    await expect(exchangeToken(tokenForm())).rejects.toMatchObject({ code: "invalid_client" });
    await expect(exchangeToken(tokenForm(), { id: "claude", secret: "s".repeat(32) })).resolves.toHaveProperty("access_token");
  });
  it("rotates refresh tokens with a compare-and-swap", async () => {
    const f = new URLSearchParams({ grant_type: "refresh_token", client_id: "claude", refresh_token: code });
    await exchangeToken(f);
    expect(mocks.updateGrant.mock.calls[0][0].where.refreshHash).toBe(hashToken(code));
    mocks.updateGrant.mockResolvedValue({ count: 0 });
    await expect(exchangeToken(f)).rejects.toThrow();
  });
  it("rejects absent/native/expired/revoked/version-mismatched tokens", async () => {
    const req = (token = code) => new Request(`${origin}/api/mcp`, { headers: { Authorization: `Bearer ${token}` } });
    expect(await authenticateMcp(req("native.token"))).toBeNull();
    expect(await authenticateMcp(new Request(`${origin}/api/mcp`))).toBeNull();
    for (const change of [{ accessExpiresAt: new Date(0) }, { revokedAt: new Date() }, { sessionVersion: 1 }, { resource: "https://evil.example" }, { clientId: "removed-client" }]) {
      mocks.findGrant.mockResolvedValue({ ...grant(), ...change }); expect(await authenticateMcp(req())).toBeNull();
    }
    mocks.findGrant.mockResolvedValue(grant()); expect(await authenticateMcp(req())).toMatchObject({ userId: "user-1" });
  });
});

async function withClient(scopes: string[], run: (client: Client) => Promise<void>) {
  const server = createMcpServer({ userId: "user-1", scopes });
  const client = new Client({ name: "test-client", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try { await run(client); } finally { await client.close(); await server.close(); }
}
describe("MCP tools via official SDK client", () => {
  it("only advertises tools permitted by the grant", async () => {
    await withClient(["events:read"], async client => {
      expect((await client.listTools()).tools.map(t => t.name)).toEqual(["list_events", "get_event_brief"]);
      const denied = await client.callTool({ name: "search_venues", arguments: { eventId: "other", query: "venue" } });
      expect(denied.isError).toBe(true); expect(mocks.search).not.toHaveBeenCalled();
    });
  });
  it("scopes list and brief queries to the token user and omits private fields", async () => {
    mocks.listEvents.mockResolvedValue([{ id: "one" }, { id: "two" }]); mocks.findEvent.mockResolvedValue(null);
    await withClient(["events:read"], async client => {
      const list = await client.callTool({ name: "list_events", arguments: { limit: 1 } });
      expect(list.structuredContent).toEqual({ events: [{ id: "one" }], nextOffset: 1 });
      expect(mocks.listEvents.mock.calls[0][0].where).toEqual(eventAccess("user-1"));
      const brief = await client.callTool({ name: "get_event_brief", arguments: { eventId: "someone-elses-event" } });
      expect(brief.isError).toBe(true);
      const args = mocks.findEvent.mock.calls[0][0]; expect(args.where).toEqual({ id: "someone-elses-event", ...eventAccess("user-1") });
      expect(args.select.claimToken).toBeUndefined(); expect(args.select.guests).toBeUndefined();
    });
  });
  it("never searches for an inaccessible event", async () => {
    mocks.findEvent.mockResolvedValue(null);
    await withClient(["venues:search"], async client => {
      expect((await client.callTool({ name: "search_venues", arguments: { eventId: "other", query: "private room" } })).isError).toBe(true);
      expect(mocks.search).not.toHaveBeenCalled();
    });
  });
  it("searches the event city and reports unverified availability", async () => {
    mocks.findEvent.mockResolvedValue({ city: "Boston, MA" }); mocks.search.mockResolvedValue([{ id: "v1", name: "Venue" }]);
    await withClient(["venues:search"], async client => {
      const r = await client.callTool({ name: "search_venues", arguments: { eventId: "mine", query: "private room" } });
      expect(mocks.search).toHaveBeenCalledWith("private room", "Boston, MA");
      expect(r.structuredContent).toMatchObject({ provider: "google", verification: expect.stringContaining("not verified") });
    });
  });
});
describe("HTTP transport", () => {
  const req = (body: unknown, headers = {}) => new Request(`${origin}/api/mcp`, { method: "POST", headers: { Authorization: `Bearer ${code}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify(body) });
  it("returns discovery challenge without authentication", async () => {
    const r = await POST(new Request(`${origin}/api/mcp`, { method: "POST", body: "{}" }));
    expect(r.status).toBe(401); expect(r.headers.get("WWW-Authenticate")).toContain("/.well-known/oauth-protected-resource/api/mcp");
  });
  it("rejects untrusted origins and oversized bodies", async () => {
    expect((await POST(req({}, { Origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(req("x".repeat(65537)))).status).toBe(413);
  });
  it("initializes through the stateless HTTP endpoint", async () => {
    const r = await POST(req({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } }));
    expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toMatchObject({ result: { serverInfo: { name: "HostKit" } } });
  });
  it("handles a tool call without shared sessions", async () => {
    mocks.listEvents.mockResolvedValue([]);
    const r = await POST(req({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_events", arguments: {} } }, { "MCP-Protocol-Version": "2025-11-25" }));
    expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ result: { structuredContent: { events: [] } } });
  });
});
