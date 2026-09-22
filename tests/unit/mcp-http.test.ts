import { describe, expect, it, vi } from "vitest";
import { issueToken } from "@/lib/api/token";
import { PRODUCTION_MCP_URL, cursorMcpConfig, originFromHeaders } from "@/lib/mcp/config";
import {
  authenticateMcpRequest,
  deploymentOrigin,
  handleMcpRequest,
  type McpAuthenticate,
} from "@/lib/mcp/http";
import { TOOLS } from "@/lib/mcp/tools";
import { GET, OPTIONS, POST } from "@/app/api/mcp/route";

const ACCEPT = "application/json, text/event-stream";
const URL = "http://localhost:3000/api/mcp";

const signedIn: McpAuthenticate = async (request) =>
  request.headers.get("authorization") === "Bearer tok_test" ? { token: "tok_test" } : null;

function rpc(method: string, params: unknown, id = 1, headers: Record<string, string> = {}) {
  return new Request(URL, {
    method: "POST",
    headers: {
      accept: ACCEPT,
      "content-type": "application/json",
      authorization: "Bearer tok_test",
      "mcp-protocol-version": "2025-03-26",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function post(
  request: Request,
  extra: { fetchImpl?: typeof fetch; baseUrl?: string; authenticate?: McpAuthenticate } = {},
) {
  const response = await handleMcpRequest(request, {
    authenticate: extra.authenticate ?? signedIn,
    fetchImpl: extra.fetchImpl,
    baseUrl: extra.baseUrl,
  });
  const text = await response.text();
  return { response, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

describe("remote MCP auth", () => {
  it("rejects a request with no token", async () => {
    const { response, body } = await post(rpc("tools/list", {}, 1, { authorization: "" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/Bearer/i);
    expect(JSON.stringify(body)).not.toMatch(/list_events/);
    expect(String((body?.error as { message: string }).message)).toMatch(/bearer token/i);
  });

  it("rejects a token the account check turns down", async () => {
    const { response } = await post(rpc("tools/list", {}), {
      authenticate: async () => null,
    });
    expect(response.status).toBe(401);
  });

  it("answers a preflight without a token", async () => {
    const response = await handleMcpRequest(new Request(URL, { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("does not open an SSE stream, even for a signed-in client", async () => {
    const response = await handleMcpRequest(
      new Request(URL, { method: "GET", headers: { accept: "text/event-stream", authorization: "Bearer tok_test" } }),
      { authenticate: signedIn },
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toMatch(/POST/);
  });

  it("fails a signed-out GET cleanly", async () => {
    const response = await GET(new Request(URL, { method: "GET" }));
    expect(response.status).toBe(401);
  });

  it("fails a signed-out POST cleanly, through the route", async () => {
    const response = await POST(
      new Request(URL, {
        method: "POST",
        headers: { accept: ACCEPT, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/bearer token/i);
  });

  it("lets OPTIONS through the route", async () => {
    const response = await OPTIONS(new Request(URL, { method: "OPTIONS" }));
    expect(response.status).toBe(204);
  });
});

describe("the bearer itself", () => {
  it("ignores a missing or non-bearer header without looking the user up", async () => {
    process.env.AUTH_SECRET = "test-secret-for-mcp";
    let lookups = 0;
    const lookup = async () => {
      lookups += 1;
      return { id: "user_1" };
    };
    for (const authorization of [undefined, "Basic abc", "Bearer", "Token nope"]) {
      const headers = authorization ? { authorization } : undefined;
      const session = await authenticateMcpRequest(new Request(URL, { headers }), lookup);
      expect(session).toBeNull();
    }
    expect(lookups).toBe(0);
  });

  it("rejects a forged token before asking the database", async () => {
    process.env.AUTH_SECRET = "test-secret-for-mcp";
    let lookups = 0;
    const session = await authenticateMcpRequest(
      new Request(URL, { headers: { authorization: "Bearer not.a.real.token" } }),
      async () => {
        lookups += 1;
        return { id: "user_1" };
      },
    );
    expect(session).toBeNull();
    expect(lookups).toBe(0);
  });

  it("accepts a signed token only when the account check does", async () => {
    process.env.AUTH_SECRET = "test-secret-for-mcp";
    const token = issueToken("user_9", 3);
    const request = new Request(URL, { headers: { authorization: `Bearer ${token}` } });
    expect(await authenticateMcpRequest(request, async () => ({ id: "user_9" }))).toEqual({ token });
    expect(await authenticateMcpRequest(request, async () => null)).toBeNull();
  });
});

describe("remote MCP tools", () => {
  it("introduces itself", async () => {
    const { response, body } = await post(
      rpc("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      }),
    );
    expect(response.status).toBe(200);
    const result = body?.result as { serverInfo: { name: string }; instructions: string };
    expect(result.serverInfo.name).toBe("hosty");
    expect(result.instructions).toMatch(/read-only/i);
  });

  it("lists the same read-only tools the stdio server has", async () => {
    const { body } = await post(rpc("tools/list", {}));
    const tools = (body?.result as { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> }).tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOLS.map((tool) => tool.name).sort());
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("calls list_events with the caller's token, against this deployment", async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ events: [{ id: "evt_1", title: "Mixer" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const { response, body } = await post(
      rpc("tools/call", { name: "list_events", arguments: {} }, 7),
      { fetchImpl },
    );
    expect(response.status).toBe(200);
    expect(calls[0]).toEqual({
      url: "http://localhost:3000/api/v1/events",
      auth: "Bearer tok_test",
    });
    const text = (body?.result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain("evt_1");
    expect(body?.error).toBeUndefined();
  });

  it("calls discover_events with the filters it was given", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ events: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const { body } = await post(
      rpc("tools/call", { name: "discover_events", arguments: { city: "Boston, MA", q: "mixer" } }),
      { fetchImpl },
    );
    expect(calls[0]).toContain("/api/v1/discover?");
    expect(calls[0]).toContain("city=Boston%2C%20MA");
    expect(calls[0]).toContain("q=mixer");
    expect((body?.result as { isError?: boolean }).isError).toBeUndefined();
  });

  it("reports a rejected token as a tool error, not a stack trace", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 401 })) as unknown as typeof fetch;
    const { body } = await post(rpc("tools/call", { name: "list_events", arguments: {} }), { fetchImpl });
    const result = body?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/token was rejected/i);
  });

  it("does not follow a forged Host header when calling the API", () => {
    const request = new Request("https://preview.tryhosty.app/api/mcp", {
      headers: { host: "evil.test", "x-forwarded-host": "evil.test" },
    });
    expect(deploymentOrigin(request)).toBe("https://preview.tryhosty.app");
  });
});

describe("the install page's addresses", () => {
  it("documents the production URL", () => {
    expect(PRODUCTION_MCP_URL).toBe("https://tryhosty.app/api/mcp");
    expect(cursorMcpConfig(PRODUCTION_MCP_URL)).toContain("https://tryhosty.app/api/mcp");
    expect(cursorMcpConfig(PRODUCTION_MCP_URL)).toContain("Bearer YOUR_TOKEN");
  });

  it("keeps serving bearer tools when the OAuth connector is also configured", async () => {
    vi.stubEnv("MCP_PUBLIC_ORIGIN", "https://hostkit.example");
    vi.stubEnv(
      "MCP_CLIENTS_JSON",
      JSON.stringify([{ id: "claude", name: "Claude", redirectUris: ["https://client.example/callback"] }]),
    );
    const { response, body } = await post(rpc("tools/list", {}));
    expect(response.status).toBe(200);
    const tools = (body?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name).sort();
    expect(tools).toEqual(["campus_events", "discover_events", "get_event", "list_events", "list_guests"]);
    expect(tools).not.toContain("search_venues");
    vi.unstubAllEnvs();
  });

  it("serves bearer tools for an API token while OAuth is configured", async () => {
    vi.stubEnv("MCP_PUBLIC_ORIGIN", "https://hostkit.example");
    vi.stubEnv("MCP_CLIENTS_JSON", "[]");
    process.env.AUTH_SECRET = "test-secret-for-mcp";
    const token = issueToken("user_9", 3);
    expect(token.includes(".")).toBe(true);
    const { response, body } = await post(rpc("tools/list", {}, 1, { authorization: `Bearer ${token}` }), {
      authenticate: async (request) =>
        request.headers.get("authorization") === `Bearer ${token}` ? { token } : null,
    });
    expect(response.status).toBe(200);
    const names = (body?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
    expect(names).toContain("list_guests");
    expect(names).not.toContain("search_venues");
    vi.unstubAllEnvs();
  });

  it("uses http for localhost and https otherwise", () => {
    expect(originFromHeaders(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(originFromHeaders(new Headers({ host: "tryhosty.app" }))).toBe("https://tryhosty.app");
    expect(
      originFromHeaders(new Headers({ "x-forwarded-host": "host-kit.vercel.app", "x-forwarded-proto": "https" })),
    ).toBe("https://host-kit.vercel.app");
  });
});
