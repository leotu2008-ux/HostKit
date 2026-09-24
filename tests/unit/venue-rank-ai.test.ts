import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankVenuesForEvent, type VenueRankEvent } from "@/lib/ai/venue-rank";
import { rankVenues } from "@/lib/venues/rank";
import type { VenueResult } from "@/lib/venues/apple-maps";

/** A fetch that answers exactly once, the way the Messages API would. Mirrors
 *  tests/unit/ai-client.test.ts's stub rather than inventing a new one. */
function replyWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function modelSays(text: string): typeof fetch {
  return replyWith({ content: [{ type: "text", text }] });
}

function venue(id: string, name: string): VenueResult {
  return {
    id,
    name,
    address: "1 Main St",
    phone: "+1 617 555 0100",
    website: "https://example.com",
    lat: 42.3601,
    lng: -71.0589,
    category: "Bar",
  };
}

// All three candidates are equally good on the deterministic score, so ties
// break by name: Alpha, Beta, Gamma — i.e. ids a, b, c in that order. Tests
// below rely on that fixed baseline order for what "topped up" looks like.
const CANDIDATES = [venue("a", "Alpha"), venue("b", "Beta"), venue("c", "Gamma")];

const EVENT: VenueRankEvent = {
  type: "MIXER",
  city: "Boston, MA",
  guestCount: 50,
  durationHours: 4,
  date: new Date("2026-10-01"),
  vibe: "cozy",
  lat: 42.3601,
  lng: -71.0589,
  venueAllocatedCents: 200_000,
};

const RANK_EVENT = {
  type: EVENT.type,
  guestCount: EVENT.guestCount,
  date: EVENT.date,
  lat: EVENT.lat,
  lng: EVENT.lng,
};

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  delete process.env.AI_MODEL;
});

afterEach(() => {
  if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved;
  delete process.env.AI_MODEL;
  vi.restoreAllMocks();
});

describe("rankVenuesForEvent — a good model answer", () => {
  it("orders venues the way the model picked, topped up to at least three", async () => {
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: modelSays(
        JSON.stringify({
          picks: [
            { id: "c", reason: "Close by and has a full bar" },
            { id: "a", reason: "Central and inside budget" },
          ],
        }),
      ),
    });
    expect(source).toBe("model");
    expect(venues.map((v) => v.id)).toEqual(["c", "a", "b"]);
  });

  it("tells the model its answer goes under picks, each with an id and a reason", async () => {
    let system = "";
    const capture = (async (url: string, init: RequestInit) => {
      system = JSON.parse(String(init.body)).system;
      return modelSays(JSON.stringify({ picks: [{ id: "a", reason: "Central" }] }))(url, init);
    }) as unknown as typeof fetch;

    await rankVenuesForEvent(CANDIDATES, EVENT, { fetchImpl: capture });

    expect(system).toContain('"picks"');
    expect(system).toContain('"id"');
    expect(system).toContain('"reason"');
  });
});

describe("rankVenuesForEvent — reconciling against the real candidates", () => {
  it("drops invented ids and tops up from the deterministic ranking", async () => {
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: modelSays(
        JSON.stringify({
          picks: [
            { id: "a", reason: "Central and inside budget" },
            { id: "fake-1", reason: "Invented by the model" },
            { id: "fake-2", reason: "Also invented" },
          ],
        }),
      ),
    });
    expect(source).toBe("model");
    expect(venues.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("dedupes a repeated id", async () => {
    const { venues } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: modelSays(
        JSON.stringify({
          picks: [
            { id: "a", reason: "Central and inside budget" },
            { id: "a", reason: "Said a second time" },
          ],
        }),
      ),
    });
    expect(venues.filter((v) => v.id === "a")).toHaveLength(1);
    expect(venues).toHaveLength(3);
  });
});

describe("rankVenuesForEvent — falling back", () => {
  it("falls back, exactly to rankVenues's own result, on a reason over 140 characters", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: modelSays(JSON.stringify({ picks: [{ id: "a", reason: "x".repeat(400) }] })),
    });
    expect(source).toBe("fallback");
    expect(venues).toEqual(rankVenues(CANDIDATES, RANK_EVENT));
  });

  it("falls back, exactly to rankVenues's own result, when the model is rate-limited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: replyWith({ error: "slow down" }, 429),
    });
    expect(source).toBe("fallback");
    expect(venues).toEqual(rankVenues(CANDIDATES, RANK_EVENT));
  });

  it("falls back without a key, and never calls fetch", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const spy = vi.fn();
    const { source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: spy as unknown as typeof fetch,
    });
    expect(source).toBe("fallback");
    expect(spy).not.toHaveBeenCalled();
  });
});
