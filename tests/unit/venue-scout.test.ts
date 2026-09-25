import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/activity", () => ({ record: vi.fn() }));

import { ALL_EVENT_TYPES } from "@/lib/catalog";
import { closestFree, scoutQueries, scoutVenues, type FreeVenue, type ScoutEvent } from "@/lib/venues/scout";
import type { VenueResult } from "@/lib/venues/types";

const BOSTON = { lat: 42.3601, lng: -71.0589 };

function place(id: string, types: string[], lat = BOSTON.lat, lng = BOSTON.lng): VenueResult {
  return { id, name: id, address: `${id} St`, phone: null, website: null, lat, lng, category: null, types };
}

function night(type: ScoutEvent["type"], vibe: string | null = null): ScoutEvent {
  return { type, guestCount: 50, vibe, city: "Boston, MA" };
}

describe("scoutQueries", () => {
  it("asks the base search, the type's own searches and its free sources", () => {
    expect(scoutQueries(night("MIXER"))).toEqual(["bar", "lounge", "brewery", "university event space"]);
  });

  it("keeps the host's vibe on the base search only", () => {
    expect(scoutQueries(night("MIXER", "chill rooftop"))[0]).toBe("bar chill rooftop");
  });

  it.each(ALL_EVENT_TYPES)("runs at most five different searches for %s", (type) => {
    const queries = scoutQueries(night(type));
    expect(queries.length).toBeLessThanOrEqual(5);
    expect(new Set(queries).size).toBe(queries.length);
  });
});

describe("scoutVenues", () => {
  it("runs each search once, in the event's city", async () => {
    const search = vi.fn(async () => [] as VenueResult[]);
    await scoutVenues(night("MIXER"), search);
    expect(search.mock.calls).toEqual([
      ["bar", "Boston, MA"],
      ["lounge", "Boston, MA"],
      ["brewery", "Boston, MA"],
      ["university event space", "Boston, MA"],
    ]);
  });

  it("keeps places that suit, drops ones that don't, keeps untyped ones for Jev, once each", async () => {
    const search = vi.fn(async () => [place("bar", ["bar", "restaurant"]), place("shop", ["clothing_store"]), place("mystery", [])]);
    const { suitable, free } = await scoutVenues(night("MIXER"), search);
    expect(suitable.map((v) => v.id)).toEqual(["bar", "mystery"]);
    expect(free).toEqual([]);
  });

  it("rules out a nightclub for a networking night even though it's also a bar", async () => {
    const search = vi.fn(async () => [place("club", ["night_club", "bar"]), place("lounge", ["lounge_bar", "bar"])]);
    const { suitable } = await scoutVenues(night("NETWORKING"), search);
    expect(suitable.map((v) => v.id)).toEqual(["lounge"]);
  });

  it("sets universities and libraries aside as free rooms, a university library as campus", async () => {
    const search = vi.fn(async () => [
      place("uni", ["university"]),
      place("unilib", ["library", "university"]),
      place("bpl", ["library"]),
    ]);
    const { suitable, free } = await scoutVenues(night("NETWORKING"), search);
    expect(suitable).toEqual([]);
    expect(free.map((v) => [v.id, v.freeSource])).toEqual([
      ["uni", "campus"],
      ["unilib", "campus"],
      ["bpl", "public"],
    ]);
  });

  it("doesn't offer a university for a dinner party", async () => {
    const search = vi.fn(async () => [place("uni", ["university"])]);
    await expect(scoutVenues(night("DINNER_PARTY"), search)).resolves.toEqual({ suitable: [], free: [] });
  });

  it("uses the searches that answered when one fails", async () => {
    const search = vi.fn(async (query: string) => {
      if (query === "lounge") throw new Error("Google Places search: 429");
      return [place("bar", ["bar"])];
    });
    const { suitable } = await scoutVenues(night("MIXER"), search);
    expect(suitable.map((v) => v.id)).toEqual(["bar"]);
  });

  it("fails like a single search did when every search fails", async () => {
    const search = vi.fn(async () => {
      throw new Error("Google Places search: 500");
    });
    await expect(scoutVenues(night("MIXER"), search)).rejects.toThrow("Google Places search: 500");
  });
});

describe("closestFree", () => {
  const free = (id: string, lat: number, lng: number): FreeVenue => ({ ...place(id, ["university"], lat, lng), freeSource: "campus" });

  it("picks the closest free room", () => {
    const near = free("near", 42.36, -71.06);
    const nearer = free("nearer", 42.3601, -71.0589);
    expect(closestFree([near, nearer], BOSTON)?.id).toBe("nearer");
  });

  it("ignores a free room too far away to be the venue", () => {
    expect(closestFree([free("nyc", 40.7128, -74.006)], BOSTON)).toBeNull();
  });

  it("is null when there's nothing free", () => {
    expect(closestFree([], BOSTON)).toBeNull();
  });
});
