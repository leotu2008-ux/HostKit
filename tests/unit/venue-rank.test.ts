import { describe, expect, it } from "vitest";
import { rankVenues } from "@/lib/venues/rank";
import type { VenueResult } from "@/lib/venues/apple-maps";

// A point in Boston, matching the event's own coordinates so "near" venues
// score with no distance penalty.
const EVENT = { type: "MIXER" as const, guestCount: 50, date: null, lat: 42.3601, lng: -71.0589 };

function venue(overrides: Partial<VenueResult> & { id: string; name: string }): VenueResult {
  return {
    address: "1 Main St",
    phone: "+1 617 555 0100",
    website: "https://example.com",
    lat: EVENT.lat,
    lng: EVENT.lng,
    category: "Bar",
    ...overrides,
  };
}

describe("rankVenues", () => {
  it("ranks a contactable venue above one with no phone or website", () => {
    const contactable = venue({ id: "a", name: "A" });
    const silent = venue({ id: "b", name: "B", phone: null, website: null });
    const ranked = rankVenues([silent, contactable], EVENT);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("ranks a category match above a clear mismatch", () => {
    const match = venue({ id: "a", name: "A", category: "Bar" });
    const mismatch = venue({ id: "b", name: "B", category: "Hardware Store" });
    const ranked = rankVenues([mismatch, match], EVENT);
    expect(ranked[0].id).toBe("a");
  });

  it("ranks a nearer venue above a further one", () => {
    const near = venue({ id: "a", name: "A", lat: EVENT.lat, lng: EVENT.lng });
    // Roughly 150km away — well past the 8km free radius.
    const far = venue({ id: "b", name: "B", lat: EVENT.lat + 1.4, lng: EVENT.lng });
    const ranked = rankVenues([far, near], EVENT);
    expect(ranked[0].id).toBe("a");
  });

  it("breaks ties by name", () => {
    const a = venue({ id: "1", name: "Alpha" });
    const b = venue({ id: "2", name: "Beta" });
    const ranked = rankVenues([b, a], EVENT);
    expect(ranked.map((v) => v.id)).toEqual(["1", "2"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => venue({ id: String(i), name: `V${i}` }));
    expect(rankVenues(many, EVENT, 3)).toHaveLength(3);
  });

  it("defaults the limit to 6", () => {
    const many = Array.from({ length: 10 }, (_, i) => venue({ id: String(i), name: `V${i}` }));
    expect(rankVenues(many, EVENT)).toHaveLength(6);
  });

  it("returns an empty array for no candidates", () => {
    expect(rankVenues([], EVENT)).toEqual([]);
  });

  it("clamps score to 0..100 and carries a written reason", () => {
    const [ranked] = rankVenues([venue({ id: "a", name: "A" })], EVENT);
    expect(ranked.score).toBeGreaterThanOrEqual(0);
    expect(ranked.score).toBeLessThanOrEqual(100);
    expect(typeof ranked.reason).toBe("string");
    expect(ranked.reason.length).toBeGreaterThan(0);
  });
});
