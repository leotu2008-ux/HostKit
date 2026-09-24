import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));

import { judgeVenues, sizeBand, stateForVenue, VENUE_MAX_KM } from "@/lib/ai/venue-judge";
import { rankVenuesForEvent, type VenueRankEvent } from "@/lib/ai/venue-rank";
import type { VenueResult } from "@/lib/venues/types";

const JEV_ON = { TYPESAFE_API_KEY: "ts-test-key", JEV_DECISIONS: "venue" };

const EVENT: VenueRankEvent = {
  type: "MIXER",
  city: "Boston, MA",
  guestCount: 40,
  durationHours: 3,
  date: null,
  lat: 42.3601,
  lng: -71.0589,
  venueAllocatedCents: 150_000,
};

function venue(id: string, name: string, lat = 42.3601, lng = -71.0589): VenueResult {
  return { id, name, address: `${id} Main St`, phone: "+1 617 555 0100", website: "https://example.com", lat, lng, category: "Bar" };
}

type Judgment = { privateP: number; space: string; spaceConf: number; fit: number; fitConf: number };

/** A Jev that judges each venue by name, and remembers every state it was sent. */
function jev(byName: Record<string, Judgment | "down">, sent: unknown[] = []): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const state = JSON.parse(String(init?.body)).state;
    sent.push(state);
    const j = byName[state.venue.name];
    if (!j || j === "down") return new Response("{}", { status: 503 });
    return new Response(
      JSON.stringify({
        model: "jev-1.13",
        answers: {
          rentsPrivate: { type: "noul", noul: j.privateP },
          spaceKind: { type: "choice", choice: j.space, confidence: j.spaceConf, probabilities: {} },
          fit: { type: "score", score: j.fit, confidence: j.fitConf, legend: {}, probabilities: {} },
        },
        usage: { input_tokens: 60, output_tokens: 3 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

const HALL: Judgment = { privateP: 0.95, space: "hall", spaceConf: 0.9, fit: 3.6, fitConf: 0.8 };
const BAR: Judgment = { privateP: 0.85, space: "bar", spaceConf: 0.8, fit: 2.1, fitConf: 0.7 };
const SHOP: Judgment = { privateP: 0.05, space: "other", spaceConf: 0.9, fit: 0.2, fitConf: 0.9 };
const MAYBE: Judgment = { privateP: 0.5, space: "restaurant", spaceConf: 0.4, fit: 2.5, fitConf: 0.3 };

beforeEach(() => {
  mocks.record.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("judgeVenues", () => {
  const CANDIDATES = [venue("s", "Corner Shop"), venue("b", "Back Bar"), venue("h", "Harbor Hall"), venue("m", "Maybe Bistro")];

  it("puts private space first, then the better fit, with reasons built from the answers", async () => {
    const result = await judgeVenues(CANDIDATES, EVENT, {
      env: JEV_ON,
      fetch: jev({ "Corner Shop": SHOP, "Back Bar": BAR, "Harbor Hall": HALL, "Maybe Bistro": MAYBE }),
    });
    expect(result?.venues.map((v) => [v.name, v.reason])).toEqual([
      ["Harbor Hall", "Rents private space · Event space"],
      ["Back Bar", "Rents private space · Bar"],
      ["Maybe Bistro", "Worth a look · Has a phone number and a site"],
      ["Corner Shop", "Has a phone number and a site"],
    ]);
    expect([...(result?.worthALook ?? [])]).toEqual(["m"]);
  });

  it("keeps a venue Jev couldn't judge, tagged worth a look", async () => {
    const result = await judgeVenues(CANDIDATES.slice(1, 3), EVENT, {
      env: JEV_ON,
      fetch: jev({ "Back Bar": "down", "Harbor Hall": HALL }),
    });
    expect(result?.venues.map((v) => v.name)).toEqual(["Harbor Hall", "Back Bar"]);
    expect(result?.worthALook.has("b")).toBe(true);
  });

  it("drops places too far away before asking Jev anything", async () => {
    const sent: { venue: { name: string } }[] = [];
    const far = venue("f", "Far Hall", 40.7128, -74.006); // New York, ~300 km
    const result = await judgeVenues([venue("h", "Harbor Hall"), far], EVENT, {
      env: JEV_ON,
      fetch: jev({ "Harbor Hall": HALL, "Far Hall": HALL }, sent),
    });
    expect(VENUE_MAX_KM).toBeLessThan(300);
    expect(result?.venues.map((v) => v.name)).toEqual(["Harbor Hall"]);
    expect(sent.map((s) => s.venue.name)).toEqual(["Harbor Hall"]);
  });

  it("sends public venue facts and the night's kind and size, never the budget", async () => {
    const sent: unknown[] = [];
    await judgeVenues([venue("h", "Harbor Hall")], EVENT, { env: JEV_ON, fetch: jev({ "Harbor Hall": HALL }, sent) });
    expect(sent[0]).toEqual({
      venue: { name: "Harbor Hall", category: "Bar", address: "h Main St" },
      event: { kind: "Mixer", size: "20 to 50 people" },
    });
    expect(JSON.stringify(sent[0])).not.toMatch(/1500|150000|budget/i);
    expect(stateForVenue(venue("h", "Harbor Hall"), EVENT)).toEqual(sent[0]);
  });

  it("logs one decision per judged venue", async () => {
    await judgeVenues([venue("h", "Harbor Hall")], EVENT, {
      env: JEV_ON,
      eventId: "evt-1",
      fetch: jev({ "Harbor Hall": HALL }),
    });
    const entry = JSON.parse(mocks.record.mock.calls[0][1].body);
    expect(entry).toMatchObject({ point: "venue", subject: "Harbor Hall", verdict: "rents private space", fellBack: false });
  });

  it("returns null, and logs the fallback, when Jev answers nothing", async () => {
    const result = await judgeVenues(CANDIDATES, EVENT, { env: JEV_ON, eventId: "evt-1", fetch: jev({}) });
    expect(result).toBeNull();
    expect(JSON.parse(mocks.record.mock.calls[0][1].body)).toMatchObject({ point: "venue", fellBack: true });
  });

  it("returns null without asking when the point is off", async () => {
    const sent: unknown[] = [];
    expect(await judgeVenues(CANDIDATES, EVENT, { env: {}, fetch: jev({ "Harbor Hall": HALL }, sent) })).toBeNull();
    expect(sent).toHaveLength(0);
  });
});

describe("rankVenuesForEvent with the venue point", () => {
  it("ranks by Jev's answers when it's on", async () => {
    const { venues, source } = await rankVenuesForEvent([venue("b", "Back Bar"), venue("h", "Harbor Hall")], EVENT, {
      jev: { env: JEV_ON, fetch: jev({ "Back Bar": BAR, "Harbor Hall": HALL }) },
    });
    expect(source).toBe("jev");
    expect(venues[0].name).toBe("Harbor Hall");
  });

  it("ranks the old way when Jev is silent", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { source } = await rankVenuesForEvent([venue("b", "Back Bar")], EVENT, {
      jev: { env: JEV_ON, fetch: jev({}) },
    });
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    expect(source).toBe("fallback");
  });
});

describe("sizeBand", () => {
  it("turns a headcount into words, so Jev never has to compare numbers", () => {
    expect([10, 20, 50, 51, 250, 400].map(sizeBand)).toEqual([
      "a small group, under 20 people",
      "20 to 50 people",
      "20 to 50 people",
      "50 to 100 people",
      "100 to 250 people",
      "a large crowd, over 250 people",
    ]);
  });
});
