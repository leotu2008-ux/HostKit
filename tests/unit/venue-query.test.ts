import { describe, expect, it } from "vitest";
import { venueQueryFor } from "@/lib/venues/query";
import { ALL_EVENT_TYPES } from "@/lib/catalog";

describe("venueQueryFor", () => {
  it("has a non-empty search term for every event type", () => {
    for (const type of ALL_EVENT_TYPES) {
      expect(venueQueryFor({ type, guestCount: 50 }).length).toBeGreaterThan(0);
    }
  });

  it("appends a sanitised vibe to the base term", () => {
    expect(venueQueryFor({ type: "MIXER", guestCount: 50, vibe: "cozy rooftop" })).toBe(
      "bar cozy rooftop",
    );
  });

  it("strips punctuation from the vibe", () => {
    expect(venueQueryFor({ type: "MIXER", guestCount: 50, vibe: "cozy! rooftop??" })).toBe(
      "bar cozy rooftop",
    );
  });

  it("keeps at most two vibe words", () => {
    expect(
      venueQueryFor({ type: "MIXER", guestCount: 50, vibe: "cozy rooftop bar downtown" }),
    ).toBe("bar cozy rooftop");
  });

  it("truncates a 500-char vibe to 40 characters", () => {
    const long = "a".repeat(500);
    const query = venueQueryFor({ type: "MIXER", guestCount: 50, vibe: long });
    // "bar " (4 chars) + at most 40 sanitised vibe characters.
    expect(query.length).toBeLessThanOrEqual(4 + 40);
    expect(query.startsWith("bar ")).toBe(true);
  });

  it("returns just the base term when there is no vibe", () => {
    expect(venueQueryFor({ type: "STUDY_BREAK", guestCount: 20 })).toBe("cafe");
  });

  it("is deterministic", () => {
    const input = { type: "FORMAL" as const, guestCount: 120, vibe: "black tie" };
    expect(venueQueryFor(input)).toBe(venueQueryFor(input));
  });

  it("searches for a lounge, not a bar, for a networking night", () => {
    expect(venueQueryFor({ type: "NETWORKING", guestCount: 50 })).toBe("cocktail lounge");
  });
});
