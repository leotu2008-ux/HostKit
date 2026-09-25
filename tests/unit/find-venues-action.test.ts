import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  rank: vi.fn(),
  requireEvent: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("@/lib/rate-limit", () => ({
  LIMITS: { venueSearch: { perEvent: [10, 60_000], perIp: [10, 60_000] } },
  RateLimitError: class RateLimitError extends Error {},
  assertRateLimit: vi.fn(async () => {}),
  clientIp: () => "203.0.113.7",
}));
vi.mock("@/lib/venues/search", () => ({ isVenueSearchConfigured: () => true, searchVenues: mocks.search }));
vi.mock("@/lib/ai/venue-rank", () => ({ rankVenuesForEvent: mocks.rank }));
vi.mock("@/lib/activity", () => ({ record: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { budgetCategory: { findUnique: vi.fn(async () => null) } } }));

import { findVenuesAction } from "@/lib/actions/venues";
import type { VenueResult } from "@/lib/venues/types";

function place(name: string, types: string[]): VenueResult {
  return { id: name, name, address: `${name} St`, phone: null, website: null, lat: 42.3601, lng: -71.0589, category: null, types };
}

function form() {
  const data = new FormData();
  data.set("eventId", "evt-1");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireEvent.mockResolvedValue({
    user: { name: "Leo" },
    event: {
      id: "evt-1",
      ownerId: "u1",
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
      lat: null,
      lng: null,
    },
  });
  mocks.rank.mockImplementation(async (candidates: VenueResult[]) => ({
    venues: candidates.map((v) => ({ ...v, score: 90, reason: "Has a site" })),
    source: "fallback",
  }));
});

describe("findVenuesAction", () => {
  it("shows the venues that suit, then the closest free room with a check-first reason", async () => {
    mocks.search.mockResolvedValue([place("Lobby Lounge", ["lounge_bar"]), place("Club Nine", ["night_club"]), place("Harvard University", ["university"])]);

    const state = await findVenuesAction(undefined, form());

    expect(state).toMatchObject({ source: "fallback" });
    const venues = state && "venues" in state ? state.venues : [];
    expect(venues.map((v) => [v.name, v.reason])).toEqual([
      ["Lobby Lounge", "Has a site"],
      ["Harvard University", "May be free for students · Check with the school's event office"],
    ]);
  });

  it("says nothing turned up when nothing suits and nothing is free", async () => {
    mocks.search.mockResolvedValue([place("Club Nine", ["night_club"])]);

    await expect(findVenuesAction(undefined, form())).resolves.toEqual({
      message: "No venues turned up nearby. Add one by hand from Outreach.",
    });
    expect(mocks.rank).not.toHaveBeenCalled();
  });

  it("says search isn't answering when every search fails", async () => {
    mocks.search.mockRejectedValue(new Error("Google Places search: 500"));

    await expect(findVenuesAction(undefined, form())).resolves.toEqual({
      message: "Venue search isn't answering right now.",
    });
  });
});
