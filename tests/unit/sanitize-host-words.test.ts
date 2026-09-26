import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn(), eventFindMany: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({ db: { event: { findMany: mocks.eventFindMany }, activity: { findMany: vi.fn() } } }));

import { HOST_WORDS_MAX_CHARS, sanitizeHostWords } from "@/lib/ai/sanitize-host-words";
import { judgeVenues } from "@/lib/ai/venue-judge";
import type { VenueRankEvent } from "@/lib/ai/venue-rank";
import { judgeNightCompetition } from "@/lib/night-competition";

/** Every amount the brief names, in one host's words. */
const PRICEY =
  "rooftop mixer, $2k all in ($1,500 venue), 500 dollars food, USD 300 drinks, 300 bucks DJ, €300 decor, £40 a head";

/** Anything that still looks like money: a currency sign, a "2k", a currency
 *  word, or one of the amounts above. */
const MONEY_LEFT = /[$€£]|\d\s?k\b|dollars?|bucks?|\busd\b|1,500|\b(?:300|500|40)\b/i;

/** A fetch that answers like the gateway, and records every request body. */
function jevRecords(sent: Array<{ state: unknown }>): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ model: "jev-1.13", answers: {}, usage: { input_tokens: 1, output_tokens: 1 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const KEY = { AI_GATEWAY_API_KEY: "gw-test-key" };

beforeEach(() => {
  mocks.record.mockReset();
  mocks.eventFindMany.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sanitizeHostWords", () => {
  it.each([
    ["wine night, $2k all in", "wine night, all in"],
    ["gala ($1,500 budget)", "gala (budget)"],
    ["500 dollars max", "max"],
    ["USD 300 for food", "for food"],
    ["300 bucks, rooftop", "rooftop"],
    ["€300 dinner", "dinner"],
    ["£40 a head", "a head"],
    ["$20–$40 tickets", "tickets"],
  ])("takes the amount out of %j", (input, expected) => {
    expect(sanitizeHostWords(input)).toBe(expected);
  });

  it("leaves numbers that aren't money alone", () => {
    expect(sanitizeHostWords("5k run, then brunch for 150 people")).toBe("5k run, then brunch for 150 people");
    expect(sanitizeHostWords("class of 2025 top 40 night")).toBe("class of 2025 top 40 night");
  });

  it("caps the length", () => {
    const long = sanitizeHostWords(`${"founders ".repeat(40)}$2k`);
    expect(long.length).toBeLessThanOrEqual(HOST_WORDS_MAX_CHARS);
    expect(long).not.toMatch(MONEY_LEFT);
  });

  it("is empty for nothing", () => {
    expect(sanitizeHostWords(null)).toBe("");
    expect(sanitizeHostWords("  $2k  ")).toBe("");
  });
});

describe("venue judge prompt", () => {
  const event: VenueRankEvent = {
    type: "MIXER",
    city: "Boston",
    guestCount: 60,
    durationHours: 3,
    date: new Date("2026-10-15T23:00:00Z"),
    kind: PRICEY,
    lat: 42.35,
    lng: -71.06,
    venueAllocatedCents: 150_000,
  };
  const venues = [
    { id: "a", name: "Harbor Hall", address: "1 Harbor Way, Boston", phone: null, website: null, lat: 42.351, lng: -71.061, category: "event_venue" },
    { id: "b", name: "Back Bay Lounge", address: "9 Newbury St, Boston", phone: null, website: null, lat: 42.352, lng: -71.062, category: "bar" },
  ];

  it("sends the host's words with no money amount in them", async () => {
    const sent: Array<{ state: unknown }> = [];
    await judgeVenues(venues, event, { env: { ...KEY, JEV_DECISIONS: "venue" }, fetch: jevRecords(sent) });

    expect(sent.length).toBeGreaterThan(0);
    for (const body of sent) {
      const state = JSON.stringify(body.state);
      expect(state).toContain("rooftop mixer");
      expect(state).not.toMatch(MONEY_LEFT);
    }
  });
});

describe("competing-night prompt", () => {
  const night = {
    id: "mine",
    city: "Boston",
    date: new Date("2026-10-15T23:00:00Z"),
    ownerId: "host-1",
    type: "MIXER" as const,
    kind: PRICEY,
  };
  const other = {
    id: "theirs",
    title: "Harbor social",
    type: "NETWORKING" as const,
    kind: "networking drinks, £40 entry, 500 dollars bar tab",
    date: new Date("2026-10-15T23:30:00Z"),
  };

  it("sends both hosts' words with no money amount in them", async () => {
    mocks.eventFindMany.mockResolvedValue([other]);
    const sent: Array<{ state: unknown }> = [];
    await judgeNightCompetition(night, { env: { ...KEY, JEV_DECISIONS: "competing" }, fetch: jevRecords(sent) });

    expect(sent).toHaveLength(1);
    const state = JSON.stringify(sent[0].state);
    expect(state).toContain("rooftop mixer");
    expect(state).toContain("networking drinks");
    expect(state).not.toMatch(MONEY_LEFT);
  });

  it("stays off unless JEV_DECISIONS names it", async () => {
    const sent: Array<{ state: unknown }> = [];
    expect(await judgeNightCompetition(night, { env: KEY, fetch: jevRecords(sent) })).toBe(0);
    expect(await judgeNightCompetition(night, { env: { ...KEY, JEV_DECISIONS: "venue,brief" }, fetch: jevRecords(sent) })).toBe(0);
    expect(sent).toHaveLength(0);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });
});
