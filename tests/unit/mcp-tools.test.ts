import { describe, expect, it } from "vitest";
import {
  HostyApiError,
  TOOLS,
  apiGet,
  query,
  toolByName,
  type ToolContext,
} from "@/lib/mcp/tools";

/** Records what was requested, so the tools can be checked without a server. */
function stubApi(body: unknown, status = 200) {
  const calls: Array<{ url: string; auth: string | null }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get("authorization") });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function ctxWith(fetchImpl: typeof fetch): ToolContext {
  return { baseUrl: "https://tryhosty.app", token: "tok_test", fetchImpl };
}

describe("the tool set", () => {
  it("is read-only, all of it", () => {
    // Writes wait for an audit log. This asserts nobody slipped one in.
    expect(TOOLS.every((tool) => tool.readOnly)).toBe(true);
  });

  it("gives every tool a distinct name", () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
  });

  it("describes every tool well enough for an agent to choose it", () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.title.length).toBeGreaterThan(3);
    }
  });

  it("can be looked up by name, and says no to anything else", () => {
    expect(toolByName("list_events")?.name).toBe("list_events");
    expect(toolByName("delete_everything")).toBeUndefined();
  });
});

describe("talking to the API", () => {
  it("sends the token on every call", async () => {
    const { calls, fetchImpl } = stubApi({ events: [] });
    await apiGet(ctxWith(fetchImpl), "/api/v1/events");
    expect(calls[0].auth).toBe("Bearer tok_test");
  });

  it("does not double the slash when the base url has a trailing one", async () => {
    const { calls, fetchImpl } = stubApi({ events: [] });
    await apiGet({ baseUrl: "https://example.test/", token: "t", fetchImpl }, "/api/v1/events");
    expect(calls[0].url).toBe("https://example.test/api/v1/events");
  });

  it("explains a rejected token instead of leaking the body", async () => {
    const { fetchImpl } = stubApi({ error: "nope" }, 401);
    await expect(apiGet(ctxWith(fetchImpl), "/api/v1/events")).rejects.toThrow(/token was rejected/i);
  });

  it("carries the status on any other failure", async () => {
    const { fetchImpl } = stubApi({ error: "boom" }, 500);
    await expect(apiGet(ctxWith(fetchImpl), "/api/v1/events")).rejects.toBeInstanceOf(
      HostyApiError,
    );
  });
});

describe("building query strings", () => {
  it("omits anything not given, so defaults stay server-side", () => {
    expect(query({ school: undefined, q: null, city: "" })).toBe("");
  });

  it("encodes what is given", () => {
    expect(query({ city: "Boston, MA" })).toBe("?city=Boston%2C%20MA");
  });

  it("joins several", () => {
    expect(query({ city: "NYC", q: "mixer" })).toBe("?city=NYC&q=mixer");
  });
});

describe("each tool hits the route it says it does", () => {
  it("list_events reads the events collection", async () => {
    const { calls, fetchImpl } = stubApi({ events: [] });
    await toolByName("list_events")!.run(ctxWith(fetchImpl), {});
    expect(calls[0].url).toContain("/api/v1/events");
  });

  it("get_event escapes the id it is handed", async () => {
    const { calls, fetchImpl } = stubApi({ event: {} });
    await toolByName("get_event")!.run(ctxWith(fetchImpl), { eventId: "ab/cd" });
    expect(calls[0].url).toContain("/api/v1/events/ab%2Fcd");
  });

  it("list_guests asks for that event's guests", async () => {
    const { calls, fetchImpl } = stubApi({ guests: [], summary: {} });
    await toolByName("list_guests")!.run(ctxWith(fetchImpl), { eventId: "evt_1" });
    expect(calls[0].url).toBe("https://tryhosty.app/api/v1/events/evt_1/guests");
  });

  it("list_guests has no email or phone", async () => {
    const { fetchImpl } = stubApi({
      guests: [
        {
          id: "g1",
          name: "Sam",
          email: "sam@babson.edu",
          phone: "+16175550100",
          status: "ATTENDING",
          plusOnes: 2,
          user: { email: "hidden@example.com", phone: "+19995550100" },
        },
      ],
      summary: { going: 1, pending: 0, waitlisted: 0, checkedIn: 0 },
    });
    const result = await toolByName("list_guests")!.run(ctxWith(fetchImpl), { eventId: "evt_1" });
    const text = JSON.stringify(result);
    expect(text).not.toContain("sam@babson.edu");
    expect(text).not.toContain("hidden@example.com");
    expect(text).not.toContain("6175550100");
    expect(text).not.toContain("9995550100");
    expect(text).not.toContain("email");
    expect(text).not.toContain("phone");
    expect(result).toEqual({
      guests: [{ id: "g1", name: "Sam", status: "ATTENDING", plusOnes: 2, user: {} }],
      summary: { going: 1, pending: 0, waitlisted: 0, checkedIn: 0 },
    });
    expect(toolByName("list_guests")!.description).toMatch(/not included/i);
  });

  it("offers the host's own events and guests, and no consumer browsing", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["list_events", "get_event", "list_guests"]);
    expect(toolByName("campus_events")).toBeUndefined();
    expect(toolByName("discover_events")).toBeUndefined();
  });
});

describe("argument schemas", () => {
  it("insists on an event id where one is needed", () => {
    expect(toolByName("get_event")!.schema.safeParse({}).success).toBe(false);
    expect(toolByName("get_event")!.schema.safeParse({ eventId: "evt_1" }).success).toBe(true);
  });

  it("lets list_events run with nothing at all", () => {
    expect(toolByName("list_events")!.schema.safeParse({}).success).toBe(true);
  });
});
