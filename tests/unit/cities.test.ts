import { describe, expect, it } from "vitest";
import { CITIES } from "@/lib/catalog";
import { US_CITIES, detectCity, isScoutedCity, nearestUsCity, suggestCities } from "@/lib/cities";

/**
 * The city table behind the Brief tab's typeahead.
 *
 * The four scouted cities in lib/catalog.ts are a subset of this one: a host
 * may name any city (the agent still drafts a plan), so the tests that matter
 * are "the scouted four are reachable by their exact strings" and "the
 * suggestions put them first when they match".
 */

describe("US_CITIES", () => {
  it("has at least 200 entries", () => {
    expect(US_CITIES.length).toBeGreaterThanOrEqual(200);
  });

  it("has no duplicate names", () => {
    const names = US_CITIES.map((city) => city.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names every city as 'City, ST'", () => {
    for (const city of US_CITIES) {
      expect(city.name).toMatch(/^[A-Za-z][A-Za-z.'\- ]*, [A-Z]{2}$/);
    }
  });

  it("carries plausible US coordinates", () => {
    for (const city of US_CITIES) {
      expect(city.lat).toBeGreaterThan(17);
      expect(city.lat).toBeLessThan(72);
      expect(city.lng).toBeGreaterThan(-180);
      expect(city.lng).toBeLessThan(-64);
    }
  });

  it("contains every scouted city with the identical string", () => {
    const names = US_CITIES.map((city) => city.name);
    for (const city of CITIES) {
      expect(names).toContain(city);
    }
  });
});

describe("suggestCities", () => {
  const names = (query: string, limit?: number) =>
    suggestCities(query, limit).map((city) => city.name);

  it("returns nothing for a blank or whitespace query", () => {
    expect(suggestCities("")).toEqual([]);
    expect(suggestCities("   ")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(suggestCities("zzz")).toEqual([]);
  });

  it("puts the scouted city first, then the others beginning with the query", () => {
    const result = names("new");
    expect(result[0]).toBe("New York, NY");
    expect(result.length).toBeGreaterThan(1);
    for (const name of result) expect(name.toLowerCase().startsWith("new")).toBe(true);
  });

  it("matches on the start of a later word in the name", () => {
    expect(names("york")).toContain("New York, NY");
  });

  it("puts Boston first for 'bos'", () => {
    expect(names("bos")[0]).toBe("Boston, MA");
  });

  it("is case-insensitive and trims the query", () => {
    expect(names("  BOSTON  ")[0]).toBe("Boston, MA");
  });

  it("matches the full 'City, ST' string a picked suggestion writes back", () => {
    expect(names("New York, NY")).toContain("New York, NY");
  });

  it("orders matching scouted cities by CITIES order, ahead of the rest", () => {
    const result = names("a");
    expect(result.slice(0, 2)).toEqual(["Los Angeles, CA", "Austin, TX"]);
  });

  it("respects the limit", () => {
    expect(names("san", 2)).toHaveLength(2);
    expect(names("a", 6)).toHaveLength(6);
  });

  it("defaults to six suggestions", () => {
    expect(suggestCities("a").length).toBeLessThanOrEqual(6);
  });

  it("never repeats a city across the match tiers", () => {
    for (const query of ["a", "san", "new", "o", "ne"]) {
      const result = names(query, 20);
      expect(new Set(result).size).toBe(result.length);
    }
  });

  it("falls back to a substring match", () => {
    // "ustin" starts no name and no word in one, so only the substring tier
    // can find Austin.
    expect(names("ustin")).toContain("Austin, TX");
  });
});

describe("nearestUsCity", () => {
  it("finds New York from a Manhattan point", () => {
    expect(nearestUsCity(40.73, -73.99)?.name).toBe("New York, NY");
  });

  it("finds a city outside the scouted four", () => {
    expect(nearestUsCity(41.88, -87.63)?.name).toBe("Chicago, IL");
  });

  it("is null in the middle of the ocean", () => {
    expect(nearestUsCity(0, 0)).toBeNull();
  });

  it("honours a tighter radius", () => {
    expect(nearestUsCity(40.73, -73.99, 0.1)).toBeNull();
  });
});

describe("detectCity", () => {
  it("prefers the scouted metro over a nearer suburb inside it", () => {
    // Babson/Wellesley: Cambridge is 10.7 miles away and Boston 12.7, but
    // Boston is the city Hosty can actually scout a venue in.
    expect(detectCity(42.2968, -71.2924)).toBe("Boston, MA");
  });

  it("prefers the scouted metro even from a listed city inside it", () => {
    const cambridge = US_CITIES.find((city) => city.name === "Cambridge, MA")!;
    expect(nearestUsCity(cambridge.lat, cambridge.lng)?.name).toBe("Cambridge, MA");
    expect(detectCity(cambridge.lat, cambridge.lng)).toBe("Boston, MA");
  });

  it("falls back to the nearest listed city outside every scouted metro", () => {
    expect(detectCity(41.8781, -87.6298)).toBe("Chicago, IL");
  });

  it("is null when nothing is close enough", () => {
    expect(detectCity(0, 0)).toBeNull();
  });

  it("returns a scouted city from its own centre", () => {
    expect(detectCity(40.7128, -74.006)).toBe("New York, NY");
    expect(detectCity(30.2672, -97.7431)).toBe("Austin, TX");
  });
});

describe("isScoutedCity", () => {
  it("is true for each of the four scouted cities", () => {
    for (const city of CITIES) expect(isScoutedCity(city)).toBe(true);
  });

  it("is false for a city Hosty only knows by name", () => {
    expect(isScoutedCity("Chicago, IL")).toBe(false);
    expect(isScoutedCity("")).toBe(false);
  });
});
