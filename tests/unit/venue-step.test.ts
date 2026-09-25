import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  rank: vi.fn(),
  budget: vi.fn(async () => null),
  findFirst: vi.fn(async () => null),
  create: vi.fn(),
}));

vi.mock("@/lib/venues/search", () => ({ searchVenues: mocks.search, venueSearchProvider: () => "google" }));
vi.mock("@/lib/ai/venue-rank", () => ({ rankVenuesForEvent: mocks.rank }));
vi.mock("@/lib/activity", () => ({ record: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    budgetCategory: { findUnique: mocks.budget },
    eventCollaborator: { findFirst: mocks.findFirst, create: mocks.create },
  },
}));

import { attachTopVenues, type VenueStepEvent } from "@/lib/agent/venue-step";
import type { VenueResult } from "@/lib/venues/types";

const EVENT: VenueStepEvent = {
  id: "evt-1",
  title: "Founders night",
  type: "NETWORKING",
  kind: "founders networking night",
  date: null,
  endDate: null,
  datesFlexible: false,
  guestCount: 50,
  durationHours: 2,
  city: "Boston, MA",
  vibe: null,
  lat: 42.3601,
  lng: -71.0589,
  owner: { name: "Leo" },
};

function place(name: string, types: string[], lat = 42.3601, lng = -71.0589): VenueResult {
  return { id: name, name, address: `${name} St`, phone: null, website: null, lat, lng, category: null, types };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rank.mockImplementation(async (candidates: VenueResult[]) => ({
    venues: candidates.map((v) => ({ ...v, score: 90, reason: "Has a site" })),
    source: "fallback",
  }));
});

describe("attachTopVenues", () => {
  it("ranks only the places that suit, then adds the closest free room, tagged", async () => {
    mocks.search.mockResolvedValue([
      place("Lobby Lounge", ["lounge_bar"]),
      place("Club Nine", ["night_club", "bar"]),
      place("Harvard University", ["university"]),
      place("NYU", ["university"], 40.7291, -73.9965),
    ]);

    const line = await attachTopVenues(EVENT);

    expect(mocks.rank.mock.calls[0][0].map((v: VenueResult) => v.name)).toEqual(["Lobby Lounge"]);
    expect(mocks.rank.mock.calls[0][1]).toMatchObject({ type: "NETWORKING", kind: "founders networking night" });
    expect(mocks.create.mock.calls.map((call) => call[0].data.name)).toEqual(["Lobby Lounge", "Harvard University"]);
    expect(mocks.create.mock.calls[1][0].data).toMatchObject({ kind: "VENUE", externalId: "Harvard University" });
    expect(mocks.create.mock.calls[1][0].data).not.toHaveProperty("sentAt");
    expect(line).toMatchObject({
      kind: "venues_attached",
      title: "2 venues lined up",
      body: "Lobby Lounge · Harvard University (may be free for students)",
    });
  });

  it("adds the free room past the limit, never in place of a suitable venue", async () => {
    mocks.search.mockResolvedValue([
      place("Lounge A", ["lounge_bar"]),
      place("Lounge B", ["lounge_bar"]),
      place("Lounge C", ["lounge_bar"]),
      place("Lounge D", ["lounge_bar"]),
      place("Boston Public Library", ["library"]),
    ]);

    const line = await attachTopVenues(EVENT);

    expect(mocks.create).toHaveBeenCalledTimes(4);
    expect(line).toMatchObject({
      title: "4 venues lined up",
      body: "Lounge A · Lounge B · Lounge C · Boston Public Library (often free)",
    });
  });

  it("lines up a free room on its own when nothing else suits, without ranking", async () => {
    mocks.search.mockResolvedValue([place("Club Nine", ["night_club"]), place("Harvard University", ["university"])]);

    const line = await attachTopVenues(EVENT);

    expect(mocks.rank).not.toHaveBeenCalled();
    expect(line).toMatchObject({ title: "1 venue lined up", body: "Harvard University (may be free for students)" });
  });

  it("says nothing turned up when nothing suits and nothing is free", async () => {
    mocks.search.mockResolvedValue([place("Club Nine", ["night_club"])]);

    const line = await attachTopVenues(EVENT);

    expect(line).toMatchObject({ kind: "venue_search_empty" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("says nothing turned up when Jev took every suitable venue off and nothing is free", async () => {
    mocks.search.mockResolvedValue([place("Lobby Lounge", ["lounge_bar"])]);
    mocks.rank.mockResolvedValue({ venues: [], source: "jev", worthALook: new Set() });

    const line = await attachTopVenues(EVENT);

    expect(line).toMatchObject({ kind: "venue_search_empty" });
  });
});
