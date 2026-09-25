import { describe, expect, it } from "vitest";
import { ALL_EVENT_TYPES } from "@/lib/catalog";
import { FREE_SOURCES, PLACE_PROFILES, freeSourceFor, placeFit } from "@/lib/venues/suitability";

describe("placeFit", () => {
  it.each([
    [["bar", "restaurant"], "MIXER", "yes"],
    [["restaurant"], "MIXER", "no"],
    [["Nightlife"], "MIXER", "yes"],
    [["night_club", "bar"], "NETWORKING", "no"],
    [["lounge_bar", "bar"], "NETWORKING", "yes"],
    [["sports_bar", "bar"], "WATCH_PARTY", "yes"],
    [["university"], "MIXER", "no"],
    [["cafe"], "RUN_CLUB", "yes"],
    [["banquet_hall"], "FORMAL", "yes"],
    [["bar"], "FORMAL", "no"],
  ] as const)("%j for a %s is %s", (types, type, expected) => {
    expect(placeFit({ types: [...types] }, type)).toBe(expected);
  });

  it("leaves a place with no type information to Jev", () => {
    expect(placeFit({ types: [] }, "MIXER")).toBe("unknown");
    expect(placeFit({}, "MIXER")).toBe("unknown");
  });

  it("leaves a place with only Google's generic types to Jev, rather than dropping it for silence", () => {
    expect(placeFit({ types: ["point_of_interest", "establishment"] }, "MIXER")).toBe("unknown");
  });

  it("still recognizes a suitable type alongside a generic one", () => {
    expect(placeFit({ types: ["bar", "point_of_interest"] }, "MIXER")).toBe("yes");
  });

  it("still rules out an unsuitable type once the generic ones are ignored", () => {
    expect(placeFit({ types: ["clothing_store", "store", "point_of_interest"] }, "MIXER")).toBe("no");
  });
});

describe("freeSourceFor", () => {
  it.each([
    [["university"], "MIXER", "campus"],
    [["University"], "WORKSHOP", "campus"],
    [["library"], "MIXER", null],
    [["library"], "NETWORKING", "public"],
    [["community_center"], "GENERAL_MEETING", "public"],
    [["library", "university"], "NETWORKING", "campus"],
    [["university"], "DINNER_PARTY", null],
    [["university"], "RUN_CLUB", null],
    [["bar"], "NETWORKING", null],
  ] as const)("%j for a %s is %s", (types, type, expected) => {
    expect(freeSourceFor({ types: [...types] }, type)).toBe(expected);
  });

  it("never treats a generic school as a free campus", () => {
    expect(freeSourceFor({ types: ["school"] }, "GENERAL_MEETING")).toBeNull();
    expect(FREE_SOURCES.campus.types).not.toContain("school");
  });
});

describe("PLACE_PROFILES", () => {
  it.each(ALL_EVENT_TYPES)("gives %s a usable profile", (type) => {
    const profile = PLACE_PROFILES[type];
    expect(profile.searches.length).toBeGreaterThanOrEqual(1);
    expect(profile.searches.length).toBeLessThanOrEqual(2);
    expect(profile.googleTypes.length).toBeGreaterThan(0);
    expect(profile.appleCategories.length).toBeGreaterThan(0);
    expect(profile.spaceKinds.length).toBeGreaterThan(0);
    expect(profile.spaceKinds).not.toContain("other");
    expect(profile.excludedTypes.filter((t) => profile.googleTypes.includes(t))).toEqual([]);
    expect(profile.freeSources.length).toBeLessThanOrEqual(2);
  });

  it("doesn't need a private room for a run club, but does for a formal", () => {
    expect(PLACE_PROFILES.RUN_CLUB.needsPrivateSpace).toBe(false);
    expect(PLACE_PROFILES.FORMAL.needsPrivateSpace).toBe(true);
  });
});
