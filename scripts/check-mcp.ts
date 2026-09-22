/** Database integration check. Run only against an isolated loopback test database. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { createAuthorizationCode, exchangeToken, authenticateMcp } from "../lib/mcp/oauth";
import { createOAuthMcpServer } from "../lib/mcp/oauth-tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Use an isolated loopback test database");
  }
  process.env.MCP_PUBLIC_ORIGIN = "https://hostkit.example";
  process.env.MCP_CLIENTS_JSON = JSON.stringify([
    { id: "test", name: "Test", redirectUris: ["https://client.example/callback"] },
  ]);
  const unique = randomUUID();
  const users: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({
        data: {
          name: "MCP test",
          email: `mcp-${unique}-${i}@example.invalid`,
          passwordHash: "not-a-login-hash",
          emailVerifiedAt: new Date(),
        },
      });
      users.push(user.id);
    }
    const own = await db.event.create({ data: { ownerId: users[0], title: "Own MCP event", city: "Boston, MA" } });
    const other = await db.event.create({
      data: { ownerId: users[1], title: "Private MCP event", city: "Boston, MA" },
    });
    const verifier = "v".repeat(43);
    const resource = "https://hostkit.example/api/mcp";
    const code = await createAuthorizationCode({
      userId: users[0],
      sessionVersion: 0,
      clientId: "test",
      resource,
      redirectUri: "https://client.example/callback",
      scopes: ["events:read", "venues:search"],
      codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    });
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "test",
      code,
      code_verifier: verifier,
      redirect_uri: "https://client.example/callback",
      resource,
    });
    const raced = await Promise.allSettled([exchangeToken(form), exchangeToken(form)]);
    assert.equal(
      raced.filter((r) => r.status === "fulfilled").length,
      1,
      "Only one concurrent code exchange may succeed",
    );
    const winning = raced.find((r) => r.status === "fulfilled");
    if (!winning || winning.status !== "fulfilled") throw new Error("No token");
    const request = (token: string) => new Request(resource, { headers: { Authorization: `Bearer ${token}` } });
    const actor = await authenticateMcp(request(winning.value.access_token));
    assert.ok(actor);
    const server = createOAuthMcpServer(actor);
    const client = new Client({ name: "db-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    try {
      const list = await client.callTool({ name: "list_events", arguments: {} });
      const payload = list.structuredContent as { events?: { id: string }[] } | undefined;
      const ids = (payload?.events ?? []).map((event) => event.id);
      assert.deepEqual(ids, [own.id]);
      assert.equal((await client.callTool({ name: "get_event_brief", arguments: { eventId: other.id } })).isError, true);
      assert.equal(
        (await client.callTool({ name: "search_venues", arguments: { eventId: other.id, query: "venue" } })).isError,
        true,
      );
    } finally {
      await client.close();
      await server.close();
    }
    const refreshForm = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "test",
      refresh_token: winning.value.refresh_token,
    });
    const refreshRace = await Promise.allSettled([exchangeToken(refreshForm), exchangeToken(refreshForm)]);
    assert.equal(
      refreshRace.filter((r) => r.status === "fulfilled").length,
      1,
      "Only one concurrent refresh may succeed",
    );
    assert.equal(await authenticateMcp(request(winning.value.access_token)), null, "Rotation invalidates old access");
    const fresh = refreshRace.find((r) => r.status === "fulfilled");
    if (!fresh || fresh.status !== "fulfilled") throw new Error("No refreshed token");
    assert.ok(await authenticateMcp(request(fresh.value.access_token)));
    await db.mcpGrant.updateMany({ where: { userId: users[0] }, data: { revokedAt: new Date() } });
    assert.equal(await authenticateMcp(request(fresh.value.access_token)), null);
    await assert.rejects(
      exchangeToken(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "test",
          refresh_token: fresh.value.refresh_token,
        }),
      ),
    );
    console.log("MCP database checks passed: migration, isolated events, atomic code/refresh consumption, revocation.");
  } finally {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
