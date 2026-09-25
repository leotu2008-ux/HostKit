# Venue Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hosty only lines up venues that suit the type of night, and adds one free room (a university, library or community centre) when one is nearby.

**Architecture:** A pure per-event-type profile (`lib/venues/suitability.ts`) says which place types, Jev space kinds and free sources suit each type. `scoutVenues` (`lib/venues/scout.ts`) runs up to five searches, drops unsuitable places by type, and sets free places aside. `judgeVenues` gains a veto on confident Jev answers. The agent's venue step and the host's "Find venues" button both scout, rank what suits, and add the closest free place as one extra option.

**Tech Stack:** Next.js 16 server actions, TypeScript, Google Places API (New) / Apple Maps Server API, Jev via `@typesafe-ai/sdk` 0.6.0, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-venue-scouting-and-event-types-design.md` (Part B)

**Depends on:** `docs/superpowers/plans/2026-09-25-more-event-types.md`, merged first. The profiles are a `Record<EventType, …>` over all eighteen types.

## Global Constraints

- Hosty never books or sends anything. Every lined-up venue is an `EventCollaborator` with `email` and `sentAt` null and a drafted `message`.
- Budget, guest names and contact details never reach Jev. The only new Jev input is the host's own words for the kind of night (`event.kind`), sent as `event.hostWords` and only when non-empty.
- Free campus rooms mean Google type `university` or Apple `University` only; never Google `school`.
- Free options are shown to every host (decision B), and each is added past the limit, never replacing a suitable venue.
- At most five searches per scout: one base query, up to two profile searches, up to two free-source searches.
- The MCP venue tool (`lib/mcp/oauth-tools.ts`) and `app/api/v1/venues/search/route.ts` keep the raw search. iOS is frozen.
- Tags, exactly: agent line `(may be free for students)` / `(often free)`; "Find venues" reason `May be free for students · Check with the school's event office` / `Often free · Check with the library or centre`.
- Tests render or call functions; never read a source file and regex it.

## Review Focus

1. **A place with no type information** (Apple without `poiCategory`, or a Google result without `types`) must be kept and left to Jev, not dropped. Pinned in Tasks 2 and 3.
2. **Jev vetoes every candidate.** The result must be an empty list that leads to "no venues", never a fallback to the old unfiltered ranking. Pinned in Tasks 4 and 5.
3. **One of the five searches fails** (a 429 or a 500) while others answer: use what answered. All fail: the same error as today. Pinned in Tasks 3 and 6.
4. **The same place returned by several searches**, or a university library matching both free sources, must appear once, as campus. Pinned in Task 3.
5. **A free room with nothing suitable beside it** must still be lined up on its own, without calling the ranker. Pinned in Task 5.

---

### Task 1: Place types on every search result

**Files:**
- Modify: `lib/venues/types.ts` (`VenueResult`)
- Modify: `lib/venues/google-maps.ts:18-28` (field mask), `:38-48` (`GooglePlace`), `:61-75` (`normalizeGooglePlace`)
- Modify: `lib/venues/apple-maps.ts` (`normalizePlace`)
- Test: `tests/unit/venues.test.ts`

**Interfaces:**
- Produces: `VenueResult.types?: string[]`. Google fills it with `primaryType` then `types`, de-duplicated. Apple fills it with `[poiCategory]` or `[]`.

- [ ] **Step 1: Update the expectations and add the failing tests**

In `tests/unit/venues.test.ts`:

- In "flattens an Apple place into a venue", add `types: ["Nightlife"],` after `category: "Nightlife",` in the expected object.
- In "flattens a Places API (New) result into a venue", add `types: ["bar"],` after `category: "Bar",`.
- In "normalizes matching places and drops incomplete ones", add `types: [],` after `category: "Bar",`.
- In "returns venues when only Google is configured", add `types: [],` after `category: null,`.

Then add to `describe("normalizeGooglePlace", …)`:

```ts
  it("keeps every place type Google gives, primary type first, once each", () => {
    const venue = normalizeGooglePlace({
      id: "ChIJHotelBar",
      displayName: { text: "The Lobby Bar" },
      location: { latitude: 42.35, longitude: -71.06 },
      primaryType: "bar",
      types: ["hotel", "bar", "point_of_interest"],
    });
    expect(venue?.types).toEqual(["bar", "hotel", "point_of_interest"]);
  });
```

and to `describe("normalizePlace", …)`:

```ts
  it("has no types when Apple gives no category", () => {
    const venue = normalizePlace({ name: "Somewhere", coordinate: { latitude: 1, longitude: 2 } });
    expect(venue?.types).toEqual([]);
  });
```

and to `describe("searchVenues through Google", …)`:

```ts
  it("asks Google for every place type", () => {
    expect(GOOGLE_PLACES_FIELD_MASK.split(",")).toContain("places.types");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/venues.test.ts`
Expected: FAIL. The objects have no `types`, and the field mask lacks `places.types`.

- [ ] **Step 3: Add the field**

In `lib/venues/types.ts`, add inside `VenueResult` after `category: string | null;`:

```ts
  /** Every type the provider gave: Google's primaryType then its types
   *  (bar, university…), or Apple's poiCategory (Nightlife, University…).
   *  Empty when the provider said nothing, which lib/venues/suitability.ts
   *  reads as "unknown", not "unsuitable". */
  types?: string[];
```

In `lib/venues/google-maps.ts`, add `"places.types",` to `GOOGLE_PLACES_FIELD_MASK` after `"places.primaryType",`; add `types?: string[];` to `GooglePlace` after `primaryType?: string;`; and in `normalizeGooglePlace`'s returned object, after the `category` line:

```ts
    types: [
      ...new Set(
        [place.primaryType, ...(place.types ?? [])]
          .map((t) => t?.trim())
          .filter((t): t is string => Boolean(t)),
      ),
    ],
```

In `lib/venues/apple-maps.ts`, in `normalizePlace`'s returned object, after `category: place.poiCategory ?? null,`:

```ts
    types: place.poiCategory ? [place.poiCategory] : [],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/venues.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/venues/types.ts lib/venues/google-maps.ts lib/venues/apple-maps.ts tests/unit/venues.test.ts
git commit -m "Keep each venue's place types from Google and Apple"
```

### Task 2: What suits each type of night

**Files:**
- Create: `lib/venues/suitability.ts`
- Test: `tests/unit/venue-suitability.test.ts`

**Interfaces:**
- Consumes: `VenueResult.types` (Task 1); `SpaceKind` (type only) from `lib/ai/venue-judge.ts`.
- Produces:
  - `type FreeSource = "campus" | "public"`
  - `FREE_SOURCES: Record<FreeSource, { search: string; types: string[]; tag: string; reason: string }>`
  - `type PlaceProfile = { searches: string[]; googleTypes: string[]; appleCategories: string[]; excludedTypes: string[]; spaceKinds: SpaceKind[]; needsPrivateSpace: boolean; freeSources: FreeSource[] }`
  - `PLACE_PROFILES: Record<EventType, PlaceProfile>`
  - `placeFit(venue: Pick<VenueResult, "types">, type: EventType): "yes" | "no" | "unknown"`
  - `freeSourceFor(venue: Pick<VenueResult, "types">, type: EventType): FreeSource | null`

- [ ] **Step 1: Write the failing tests**

`tests/unit/venue-suitability.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/venue-suitability.test.ts`
Expected: FAIL with "Failed to resolve import "@/lib/venues/suitability"".

- [ ] **Step 3: Write the module**

`lib/venues/suitability.ts`:

```ts
import type { EventType } from "@/generated/prisma/enums";
import type { SpaceKind } from "@/lib/ai/venue-judge";
import type { VenueResult } from "@/lib/venues/types";

/**
 * Which places suit which night, decided by code before Jev sees anything.
 *
 * A maps result carries a type (Google's `bar`, `university`; Apple's
 * `Nightlife`) and nothing about capacity, price or availability. So the
 * type is the one certain filter there is: a networking night never needs a
 * nightclub, a formal never needs a pub. Everything past it is Jev's
 * judgement (lib/ai/venue-judge.ts), which reads `spaceKinds` and
 * `needsPrivateSpace` from here.
 *
 * Free sources are rooms that often cost nothing: a university's, for its
 * students, and a public library's or community centre's, for anyone. Hosty
 * can't book them or know they're free, so they're tagged "may be free" and
 * the host checks.
 */

export type FreeSource = "campus" | "public";

export const FREE_SOURCES: Record<FreeSource, { search: string; types: string[]; tag: string; reason: string }> = {
  // Universities only. Google's generic `school` also covers driving and
  // dance schools, and K-12 schools don't host outside adult events.
  campus: {
    search: "university event space",
    types: ["university", "University"],
    tag: "may be free for students",
    reason: "May be free for students · Check with the school's event office",
  },
  public: {
    search: "public library meeting room",
    types: ["library", "community_center", "Library"],
    tag: "often free",
    reason: "Often free · Check with the library or centre",
  },
};

/** Campus first: a university library is a campus room. */
const FREE_ORDER: FreeSource[] = ["campus", "public"];

export type PlaceProfile = {
  /** Searches beyond venueQueryFor's, so one word ("bar") isn't the whole scan. */
  searches: string[];
  /** Google place types (Table A) that suit the night. */
  googleTypes: string[];
  /** Apple Maps poiCategory values that suit the night. */
  appleCategories: string[];
  /** Types that rule a place out even when another of its types suits. */
  excludedTypes: string[];
  /** Jev's space kinds that suit the night; anything else is vetoed. */
  spaceKinds: SpaceKind[];
  /** Whether Jev's confident "no private space" rules a place out. */
  needsPrivateSpace: boolean;
  /** Free rooms worth offering for this night. */
  freeSources: FreeSource[];
};

export const PLACE_PROFILES: Record<EventType, PlaceProfile> = {
  BIRTHDAY: {
    searches: ["bar with private room", "karaoke bar"],
    googleTypes: ["event_venue", "banquet_hall", "bar", "pub", "wine_bar", "cocktail_bar", "lounge_bar", "night_club", "karaoke", "bowling_alley", "amusement_center", "restaurant", "brewery", "brewpub", "beer_garden"],
    appleCategories: ["Nightlife", "Restaurant", "Brewery", "Winery", "Bowling", "MusicVenue"],
    excludedTypes: [],
    spaceKinds: ["bar", "restaurant", "hall", "outdoor"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  CORPORATE_OFFSITE: {
    searches: ["hotel meeting room", "conference venue"],
    googleTypes: ["event_venue", "convention_center", "hotel", "coworking_space", "banquet_hall", "cultural_center"],
    appleCategories: ["Hotel", "ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  LAUNCH_PARTY: {
    searches: ["rooftop bar", "gallery event space"],
    googleTypes: ["event_venue", "banquet_hall", "art_gallery", "museum", "cultural_center", "bar", "cocktail_bar", "lounge_bar", "night_club", "brewery"],
    appleCategories: ["Nightlife", "Museum", "Brewery", "MusicVenue"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "outdoor", "restaurant"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  DINNER_PARTY: {
    searches: ["restaurant private room", "wine bar"],
    googleTypes: ["restaurant", "fine_dining_restaurant", "wine_bar", "event_venue"],
    appleCategories: ["Restaurant", "Winery"],
    excludedTypes: [],
    spaceKinds: ["restaurant", "bar"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  FUNDRAISER: {
    searches: ["event space", "hotel ballroom"],
    googleTypes: ["banquet_hall", "event_venue", "cultural_center", "art_gallery", "museum", "hotel"],
    appleCategories: ["Hotel", "Museum", "ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "restaurant", "bar"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  MIXER: {
    searches: ["lounge", "brewery"],
    googleTypes: ["bar", "pub", "wine_bar", "cocktail_bar", "lounge_bar", "brewery", "brewpub", "beer_garden", "event_venue"],
    appleCategories: ["Nightlife", "Brewery", "Winery"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "outdoor", "restaurant"],
    needsPrivateSpace: true,
    freeSources: ["campus"],
  },
  GENERAL_MEETING: {
    searches: ["event space", "coworking space"],
    googleTypes: ["event_venue", "coworking_space", "cultural_center"],
    appleCategories: ["ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["meeting", "hall"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  FORMAL: {
    searches: ["ballroom", "hotel ballroom"],
    googleTypes: ["banquet_hall", "event_venue", "hotel", "wedding_venue"],
    appleCategories: ["Hotel"],
    excludedTypes: [],
    spaceKinds: ["hall"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  PITCH_NIGHT: {
    searches: ["auditorium", "coworking space"],
    googleTypes: ["event_venue", "auditorium", "coworking_space", "convention_center", "cultural_center", "performing_arts_theater"],
    appleCategories: ["ConventionCenter", "Theater"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  STUDY_BREAK: {
    searches: ["coffee shop", "bakery"],
    googleTypes: ["cafe", "coffee_shop", "bakery", "event_venue"],
    appleCategories: ["Cafe", "Bakery"],
    excludedTypes: [],
    spaceKinds: ["cafe", "hall", "meeting"],
    needsPrivateSpace: false,
    freeSources: ["campus", "public"],
  },
  NETWORKING: {
    searches: ["hotel bar", "event space"],
    googleTypes: ["lounge_bar", "cocktail_bar", "wine_bar", "bar", "event_venue", "hotel", "coworking_space", "restaurant"],
    appleCategories: ["Hotel", "Nightlife", "Winery"],
    // Somewhere people can hear each other.
    excludedTypes: ["night_club", "sports_bar", "karaoke"],
    spaceKinds: ["bar", "hall", "meeting", "restaurant"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  WORKSHOP: {
    searches: ["event space", "coworking space"],
    googleTypes: ["event_venue", "coworking_space", "cultural_center", "art_gallery"],
    appleCategories: ["ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["meeting", "hall", "cafe"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  SPEAKER_EVENT: {
    searches: ["event space", "lecture hall"],
    googleTypes: ["auditorium", "event_venue", "performing_arts_theater", "cultural_center", "convention_center", "coworking_space"],
    appleCategories: ["Theater", "ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  HACKATHON: {
    searches: ["coworking space", "convention center"],
    googleTypes: ["event_venue", "coworking_space", "convention_center"],
    appleCategories: ["ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus"],
  },
  GAME_NIGHT: {
    searches: ["board game cafe", "pub"],
    googleTypes: ["pub", "bar", "cafe", "brewery", "brewpub", "amusement_center", "bowling_alley", "event_venue"],
    appleCategories: ["Nightlife", "Cafe", "Brewery", "Bowling"],
    excludedTypes: ["night_club"],
    spaceKinds: ["bar", "cafe", "hall", "restaurant"],
    needsPrivateSpace: false,
    freeSources: ["campus", "public"],
  },
  WATCH_PARTY: {
    searches: ["bar with big screens", "movie theater private screening"],
    googleTypes: ["sports_bar", "bar", "pub", "brewery", "brewpub", "movie_theater", "event_venue"],
    appleCategories: ["Nightlife", "Brewery", "MovieTheater"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "restaurant"],
    needsPrivateSpace: false,
    freeSources: ["campus"],
  },
  SHOWCASE: {
    searches: ["open mic bar", "small theater"],
    googleTypes: ["live_music_venue", "performing_arts_theater", "concert_hall", "comedy_club", "auditorium", "bar", "cafe", "event_venue"],
    appleCategories: ["MusicVenue", "Theater", "Nightlife"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "cafe"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  RUN_CLUB: {
    searches: ["brewery", "cafe"],
    googleTypes: ["cafe", "coffee_shop", "brewery", "brewpub", "beer_garden", "park"],
    appleCategories: ["Cafe", "Brewery", "Park"],
    excludedTypes: [],
    spaceKinds: ["cafe", "bar", "outdoor"],
    needsPrivateSpace: false,
    freeSources: [],
  },
};

/** Whether a place's types suit the night. "unknown" when the provider gave
 *  no types: kept, and left to Jev, rather than dropped for silence. */
export function placeFit(venue: Pick<VenueResult, "types">, type: EventType): "yes" | "no" | "unknown" {
  const types = venue.types ?? [];
  if (types.length === 0) return "unknown";
  const profile = PLACE_PROFILES[type];
  if (types.some((t) => profile.excludedTypes.includes(t))) return "no";
  return types.some((t) => profile.googleTypes.includes(t) || profile.appleCategories.includes(t)) ? "yes" : "no";
}

/** The free source a place belongs to, when that source suits this night. */
export function freeSourceFor(venue: Pick<VenueResult, "types">, type: EventType): FreeSource | null {
  const types = venue.types ?? [];
  const wanted = PLACE_PROFILES[type].freeSources;
  for (const source of FREE_ORDER) {
    if (!wanted.includes(source)) continue;
    if (types.some((t) => FREE_SOURCES[source].types.includes(t))) return source;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/venue-suitability.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/venues/suitability.ts tests/unit/venue-suitability.test.ts
git commit -m "Say which places suit each type of night, and which rooms may be free"
```

### Task 3: Scouting: several searches, filtered, with free rooms set aside

**Files:**
- Create: `lib/venues/scout.ts`
- Test: `tests/unit/venue-scout.test.ts`

**Interfaces:**
- Consumes: `searchVenues(query, city)` (`lib/venues/search.ts`), `venueQueryFor` (`lib/venues/query.ts`), `PLACE_PROFILES`, `FREE_SOURCES`, `placeFit`, `freeSourceFor` (Task 2), `kmBetween` (`lib/venues/rank.ts`), `VENUE_MAX_KM` (`lib/ai/venue-judge.ts`).
- Produces:
  - `type FreeVenue = VenueResult & { freeSource: FreeSource }`
  - `type ScoutEvent = { type: EventType; guestCount: number; vibe: string | null; city: City }`
  - `scoutQueries(event: ScoutEvent): string[]`
  - `scoutVenues(event: ScoutEvent, search?: (query: string, city: City) => Promise<VenueResult[]>): Promise<{ suitable: VenueResult[]; free: FreeVenue[] }>`
  - `closestFree(free: FreeVenue[], at: { lat: number; lng: number }): FreeVenue | null`

- [ ] **Step 1: Write the failing tests**

`tests/unit/venue-scout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/venue-scout.test.ts`
Expected: FAIL with "Failed to resolve import "@/lib/venues/scout"".

- [ ] **Step 3: Write the module**

`lib/venues/scout.ts`:

```ts
import type { EventType } from "@/generated/prisma/enums";
import type { City } from "@/lib/catalog";
import { VENUE_MAX_KM } from "@/lib/ai/venue-judge";
import { venueQueryFor } from "@/lib/venues/query";
import { kmBetween } from "@/lib/venues/rank";
import { searchVenues } from "@/lib/venues/search";
import { FREE_SOURCES, PLACE_PROFILES, freeSourceFor, placeFit, type FreeSource } from "@/lib/venues/suitability";
import type { VenueResult } from "@/lib/venues/types";

/**
 * The venue scan behind the agent's venue step and the host's "Find venues".
 *
 * One search word was the whole scan before ("bar" for a mixer, 12 results).
 * Now: the base query with the host's vibe, the night's own searches and its
 * free sources' searches, at most five, in parallel. Places whose type rules
 * them out are dropped here, before Jev or the ranker sees them; free rooms
 * are set aside, because Hosty offers one of them on top of the paid list
 * rather than ranking it against bars.
 */

export type FreeVenue = VenueResult & { freeSource: FreeSource };

export type ScoutEvent = { type: EventType; guestCount: number; vibe: string | null; city: City };

type Search = (query: string, city: City) => Promise<VenueResult[]>;

export function scoutQueries(event: ScoutEvent): string[] {
  const profile = PLACE_PROFILES[event.type];
  return [
    ...new Set([
      venueQueryFor({ type: event.type, guestCount: event.guestCount, vibe: event.vibe }),
      ...profile.searches,
      ...profile.freeSources.map((source) => FREE_SOURCES[source].search),
    ]),
  ];
}

export async function scoutVenues(
  event: ScoutEvent,
  search: Search = searchVenues,
): Promise<{ suitable: VenueResult[]; free: FreeVenue[] }> {
  const settled = await Promise.allSettled(scoutQueries(event).map((query) => search(query, event.city)));
  const answered = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (answered.length === 0) {
    // Every search failed: surface the first failure, as one search did.
    const first = settled[0];
    throw first?.status === "rejected" ? first.reason : new Error("Venue search isn't answering");
  }

  const seen = new Set<string>();
  const suitable: VenueResult[] = [];
  const free: FreeVenue[] = [];
  for (const venue of answered.flat()) {
    if (seen.has(venue.id)) continue;
    seen.add(venue.id);
    const source = freeSourceFor(venue, event.type);
    if (source) free.push({ ...venue, freeSource: source });
    else if (placeFit(venue, event.type) !== "no") suitable.push(venue);
  }
  return { suitable, free };
}

/** The free room closest to the event, if one is near enough to be the venue. */
export function closestFree(free: FreeVenue[], at: { lat: number; lng: number }): FreeVenue | null {
  let best: { venue: FreeVenue; km: number } | null = null;
  for (const venue of free) {
    const km = kmBetween(venue.lat, venue.lng, at.lat, at.lng);
    if (km > VENUE_MAX_KM) continue;
    if (!best || km < best.km) best = { venue, km };
  }
  return best?.venue ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/venue-scout.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/venues/scout.ts tests/unit/venue-scout.test.ts
git commit -m "Scout venues with several searches, filtered by type, free rooms set aside"
```

### Task 4: Jev's veto, and the host's words

**Files:**
- Modify: `lib/ai/venue-rank.ts:36-47` (`VenueRankEvent` gains `kind`)
- Modify: `lib/ai/venue-judge.ts` (header comment, `stateForVenue`, `judgeVenues`, new `FIT_VETO_AT`)
- Modify: `docs/backend.md:59` (the `venue` row of the Jev table)
- Test: `tests/unit/jev-venue.test.ts`

**Interfaces:**
- Consumes: `PLACE_PROFILES` (Task 2).
- Produces: `VenueRankEvent.kind?: string | null`; `FIT_VETO_AT = 1`; `judgeVenues` drops confident misfits and can return `{ venues: [], worthALook: Set }`; `stateForVenue` adds `event.hostWords` when the host's words are non-empty.

- [ ] **Step 1: Update the existing test and write the failing tests**

In `tests/unit/jev-venue.test.ts`, "puts private space first, then the better fit, with reasons built from the answers" now expects Corner Shop to be vetoed: Jev is confident it's "other", with a fit of 0.2 and no private space. Replace that test's first `expect` with:

```ts
    expect(result?.venues.map((v) => [v.name, v.reason])).toEqual([
      ["Harbor Hall", "Rents private space · Event space"],
      ["Back Bar", "Rents private space · Bar"],
      ["Maybe Bistro", "Worth a look · Has a phone number and a site"],
    ]);
```

Then add to `describe("judgeVenues", …)`:

```ts
  const NO_ROOM_BAR: Judgment = { privateP: 0.1, space: "bar", spaceConf: 0.9, fit: 2.5, fitConf: 0.8 };
  const STRETCH: Judgment = { privateP: 0.9, space: "bar", spaceConf: 0.9, fit: 1, fitConf: 0.9 };

  it("vetoes a bar with no private room for a mixer, but keeps it for a watch party", async () => {
    const candidates = [venue("n", "Open Bar")];
    const fetch = jev({ "Open Bar": NO_ROOM_BAR });
    const mixer = await judgeVenues(candidates, EVENT, { env: JEV_ON, fetch });
    const watch = await judgeVenues(candidates, { ...EVENT, type: "WATCH_PARTY" }, { env: JEV_ON, fetch });
    expect(mixer?.venues).toEqual([]);
    expect(watch?.venues.map((v) => v.name)).toEqual(["Open Bar"]);
  });

  it("vetoes a place Jev is sure is a stretch", async () => {
    const result = await judgeVenues([venue("s", "Stretch Bar")], EVENT, { env: JEV_ON, fetch: jev({ "Stretch Bar": STRETCH }) });
    expect(result?.venues).toEqual([]);
  });

  it("vetoes the wrong kind of place for the night: a bar for a formal", async () => {
    const result = await judgeVenues([venue("b", "Back Bar")], { ...EVENT, type: "FORMAL" }, { env: JEV_ON, fetch: jev({ "Back Bar": BAR }) });
    expect(result?.venues).toEqual([]);
  });

  it("returns an empty list, not the old ranking, when Jev vetoes everything", async () => {
    const result = await judgeVenues([venue("s", "Corner Shop")], EVENT, { env: JEV_ON, fetch: jev({ "Corner Shop": SHOP }) });
    expect(result).not.toBeNull();
    expect(result?.venues).toEqual([]);
  });

  it("logs a vetoed venue as vetoed", async () => {
    await judgeVenues([venue("s", "Corner Shop")], EVENT, { env: JEV_ON, eventId: "evt-1", fetch: jev({ "Corner Shop": SHOP }) });
    const entry = JSON.parse(mocks.record.mock.calls[0][1].body);
    expect(entry).toMatchObject({ point: "venue", subject: "Corner Shop", verdict: "vetoed" });
  });

  it("tells Jev the host's own words for the night, and nothing else new", async () => {
    const sent: unknown[] = [];
    await judgeVenues([venue("h", "Harbor Hall")], { ...EVENT, kind: "founders networking night" }, {
      env: JEV_ON,
      fetch: jev({ "Harbor Hall": HALL }, sent),
    });
    expect(sent[0]).toEqual({
      venue: { name: "Harbor Hall", category: "Bar", address: "h Main St" },
      event: { kind: "Mixer", size: "20 to 50 people", hostWords: "founders networking night" },
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/jev-venue.test.ts`
Expected: FAIL. Corner Shop is still in the list, the no-room bar and the stretch are kept, nothing is logged as "vetoed", and `hostWords` is missing.

- [ ] **Step 3: Add `kind` to the ranking event**

In `lib/ai/venue-rank.ts`, add to `VenueRankEvent` after `vibe?: string | null;`:

```ts
  /** The host's own words for the kind of night ("founders networking
   *  night"). Jev's venue point reads it; nothing else here does. */
  kind?: string | null;
```

- [ ] **Step 4: Add the veto and the host's words**

In `lib/ai/venue-judge.ts`:

Add `import { PLACE_PROFILES } from "@/lib/venues/suitability";` to the imports.

After `export const FIT_MIN_CONFIDENCE = 0.55;` add:

```ts
/** A confident fit at or below this ("Wrong kind of place", "A stretch")
 *  takes a venue off the list. */
export const FIT_VETO_AT = 1;
```

Replace `stateForVenue` with:

```ts
/** Public facts about the place, the night's kind and size, and the host's
 *  own words for the night when they gave any. No budget, no guests, no host
 *  details, no address beyond the venue's own. */
export function stateForVenue(venue: VenueResult, event: Pick<VenueRankEvent, "type" | "guestCount" | "kind">) {
  const hostWords = event.kind?.trim() ?? "";
  return {
    venue: { name: venue.name, category: venue.category ?? "unknown", address: venue.address },
    event: {
      kind: EVENT_TYPE_LABEL[event.type],
      size: sizeBand(event.guestCount),
      ...(hostWords ? { hostWords } : {}),
    },
  };
}
```

In `judgeVenues`, add `const profile = PLACE_PROFILES[event.type];` right after the `rankEvent` object. Then, inside `floor.forEach`, replace everything from `const rentsPrivate = …` down to the end of the `if (opts.eventId) { logs.push(…) }` block with:

```ts
    const rentsPrivate = yesNo(decision.answers.rentsPrivate, PRIVATE_BAND);
    const space = picked<SpaceKind>(decision.answers.spaceKind, SPACE_MIN_CONFIDENCE);
    const fit = scored(decision.answers.fit, FIT_MIN_CONFIDENCE);
    const worthALook = rentsPrivate === "unsure" || fit === "unsure";
    // Only a confident answer takes a venue off the list; an unsure one keeps
    // it, tagged worth a look.
    const vetoed =
      (rentsPrivate === "no" && profile.needsPrivateSpace) ||
      (space !== "unsure" && !profile.spaceKinds.includes(space)) ||
      (fit !== "unsure" && fit <= FIT_VETO_AT);

    if (!vetoed) {
      judged.push({
        venue: { ...venue, reason: reasonFrom(rentsPrivate, space, venue.reason, worthALook) },
        tier: rentsPrivate === "yes" ? 0 : rentsPrivate === "unsure" ? 1 : 2,
        fit: fit === "unsure" ? -1 : fit,
        worthALook,
      });
    }
    if (opts.eventId) {
      logs.push(
        logDecision(opts.eventId, {
          point: "venue",
          subject: venue.name,
          answers: summarize(decision.answers),
          verdict: vetoed
            ? "vetoed"
            : worthALook
              ? "worth a look"
              : rentsPrivate === "yes"
                ? "rents private space"
                : "judged",
          model: decision.model,
          fellBack: false,
          ms: decision.ms,
          inputTokens: decision.inputTokens,
        }),
      );
    }
```

In the file's header comment, replace the sentence "A venue Jev wasn't sure about stays on the list, tagged "worth a look"." with:

```
 * A venue Jev is confident doesn't suit the night (the wrong kind of place
 * for it, a fit of "a stretch" or worse, or no private space when the night
 * needs one) is taken off the list. A venue Jev wasn't sure about stays on it,
 * tagged "worth a look". When Jev takes everything off, the list is empty:
 * the caller says nothing suitable turned up, and never falls back to the
 * unfiltered ranking.
```

- [ ] **Step 5: Update the docs row**

In `docs/backend.md`, replace the `venue` row of the Jev table with:

```
| `venue` | `lib/ai/venue-judge.ts`, after the type filter (`lib/venues/suitability.ts`) and a distance filter | Rents private space? What kind of place? How well does it fit? It also hears the host's own words for the night | Confidently the wrong kind, a stretch, or no private room when the night needs one: removed. Unsure: kept and tagged "worth a look". All silent: the old ranking, over places that already passed the type filter |
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/jev-venue.test.ts tests/unit/venue-rank-ai.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/venue-rank.ts lib/ai/venue-judge.ts docs/backend.md tests/unit/jev-venue.test.ts
git commit -m "Jev takes confidently unsuitable venues off the list, and hears the host's words"
```

### Task 5: The agent's venue step scouts, and offers one free room

**Files:**
- Modify: `lib/agent/venue-step.ts` (imports, header comment, `VenueStepEvent`, `attachTopVenues`)
- Test: `tests/unit/venue-step.test.ts` (new)

**Interfaces:**
- Consumes: `scoutVenues`, `closestFree`, `FreeVenue` (Task 3); `FREE_SOURCES` (Task 2); `rankVenuesForEvent` with `kind` (Task 4).
- Produces: `VenueStepEvent` gains `kind: string | null`. `attachTopVenues` returns `venues_attached` with the free room last, tagged, or `venue_search_empty`. `lib/agent/run.ts:309` already passes the full event row, which has `kind`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/venue-step.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  rank: vi.fn(),
  budget: vi.fn(async () => null),
  findFirst: vi.fn(async () => null),
  create: vi.fn(async () => ({})),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/venue-step.test.ts`
Expected: FAIL. `attachTopVenues` searches once with "cocktail lounge", Club Nine and the universities reach the ranker, and no free tag appears.

- [ ] **Step 3: Rewrite the step**

In `lib/agent/venue-step.ts`, replace the imports with:

```ts
import type { CollaboratorSource } from "@/generated/prisma/enums";
import type { ActivityLine } from "@/lib/activity";
import { db } from "@/lib/db";
import { CITY_CENTERS, isCity } from "@/lib/catalog";
import { composeInquiry, type OutreachEvent } from "@/lib/outreach";
import { rankVenuesForEvent } from "@/lib/ai/venue-rank";
import { closestFree, scoutVenues, type FreeVenue } from "@/lib/venues/scout";
import { venueSearchProvider } from "@/lib/venues/search";
import { FREE_SOURCES } from "@/lib/venues/suitability";
import type { VenueResult } from "@/lib/venues/types";
```

In the header comment, replace "The candidates come from the configured maps provider, never from the model; the model only reorders and explains a fixed list (lib/ai/venue-rank.ts)." with:

```
 * The candidates come from the configured maps provider, never from the
 * model: lib/venues/scout.ts runs the searches and drops places whose type
 * doesn't suit the night, and the model or Jev only reorders, explains or
 * vetoes that fixed list (lib/ai/venue-rank.ts). The closest free room (a
 * university, a library) is added past the limit, tagged "may be free".
```

Add `kind: string | null;` to `VenueStepEvent` after `id: string;`.

In `attachTopVenues`, keep the `limit` line and the `isCity` check. Replace everything from `const candidates = await searchVenues(` to the function's closing brace with:

```ts
  const scouted = await scoutVenues({
    type: event.type,
    guestCount: event.guestCount,
    vibe: event.vibe,
    city: event.city,
  });

  const centre = CITY_CENTERS[event.city];
  const at = { lat: event.lat ?? centre.lat, lng: event.lng ?? centre.lng };
  const freeRoom = closestFree(scouted.free, at);
  const empty: ActivityLine = { actor: "agent", kind: "venue_search_empty", title: "No venues turned up nearby" };

  if (scouted.suitable.length === 0 && !freeRoom) return empty;

  let top: VenueResult[] = [];
  let worthALook: Set<string> | undefined;
  if (scouted.suitable.length > 0) {
    const venueAllocation = await db.budgetCategory.findUnique({
      where: { eventId_category: { eventId: event.id, category: "VENUE" } },
    });
    const ranked = await rankVenuesForEvent(
      scouted.suitable,
      {
        type: event.type,
        city: event.city,
        guestCount: event.guestCount,
        durationHours: event.durationHours,
        date: event.date,
        vibe: event.vibe,
        kind: event.kind,
        lat: at.lat,
        lng: at.lng,
        venueAllocatedCents: venueAllocation?.allocatedCents ?? null,
      },
      { fetchImpl: options.fetchImpl, eventId: event.id },
    );
    top = ranked.venues.slice(0, limit);
    worthALook = ranked.worthALook;
  }

  // The free room goes past the limit, so it never pushes out a suitable one.
  const lineup: Array<VenueResult | FreeVenue> = freeRoom ? [...top, freeRoom] : top;
  if (lineup.length === 0) return empty;

  const hostName = event.owner?.name ?? "the host";
  const source = providerSource();

  for (const venue of lineup) {
    const existing = await db.eventCollaborator.findFirst({
      where: { eventId: event.id, kind: "VENUE", externalId: venue.id },
    });
    if (existing) continue;

    await db.eventCollaborator.create({
      data: {
        eventId: event.id,
        kind: "VENUE",
        name: venue.name,
        detail: venue.address || null,
        phone: venue.phone,
        website: venue.website,
        source,
        externalId: venue.id,
        lat: venue.lat,
        lng: venue.lng,
        // Stored so the host reads the agent's exact words before deciding to
        // send them, rather than a message composed fresh at send time.
        // `email` and `sentAt` are left at their null defaults on purpose:
        // there is nowhere for this to go and nothing has gone anywhere.
        message: composeInquiry(event, { name: venue.name, role: "VENUE" }, hostName).body,
      },
    });
  }

  return {
    actor: "agent",
    kind: "venues_attached",
    title: `${lineup.length} venue${lineup.length === 1 ? "" : "s"} lined up`,
    // A venue Jev wasn't sure about is still lined up, and says so; a free
    // room says it may be free.
    body: lineup
      .map((venue) =>
        "freeSource" in venue
          ? `${venue.name} (${FREE_SOURCES[venue.freeSource].tag})`
          : worthALook?.has(venue.id)
            ? `${venue.name} (worth a look)`
            : venue.name,
      )
      .join(" · "),
    href: `/events/${event.id}/outreach`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/venue-step.test.ts tests/unit/agent-steps.test.ts tests/unit/hosty-voice.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0. `hosty-voice` still turns "2 venues lined up" plus the body into "I lined up 2 venues: …. Nothing's been sent."

- [ ] **Step 5: Commit**

```bash
git add lib/agent/venue-step.ts tests/unit/venue-step.test.ts
git commit -m "The agent lines up only suitable venues, plus the closest free room"
```

### Task 6: The host's "Find venues" button scouts too

**Files:**
- Modify: `lib/actions/venues.ts:11-12` (imports), `:39-52` (doc comment), `:80-129` (search, rank, result)
- Test: `tests/unit/find-venues-action.test.ts` (new)

**Interfaces:**
- Consumes: `scoutVenues`, `closestFree` (Task 3); `FREE_SOURCES` (Task 2); `rankVenuesForEvent` with `kind` (Task 4); `RankedVenue` from `lib/venues/rank.ts`.
- Produces: `findVenuesAction` returns suitable venues first, then the closest free room with `reason` from `FREE_SOURCES[source].reason`. `FindVenuesState` and `FoundVenue` are unchanged.

- [ ] **Step 1: Write the failing tests**

`tests/unit/find-venues-action.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/find-venues-action.test.ts`
Expected: FAIL. Club Nine and Harvard reach the ranker as ordinary venues, and no free-room reason appears.

- [ ] **Step 3: Switch the action to scouting**

In `lib/actions/venues.ts`, replace the two imports

```ts
import { isVenueSearchConfigured, searchVenues } from "@/lib/venues/search";
import { venueQueryFor } from "@/lib/venues/query";
```

with:

```ts
import { isVenueSearchConfigured } from "@/lib/venues/search";
import { closestFree, scoutVenues } from "@/lib/venues/scout";
import { FREE_SOURCES } from "@/lib/venues/suitability";
import type { RankedVenue } from "@/lib/venues/rank";
import type { VenueResult } from "@/lib/venues/types";
```

In the doc comment above `findVenuesAction`, replace `"Find venues" — one paid Maps search and one model call, per press.` with `"Find venues" — up to five paid Maps searches (lib/venues/scout.ts) and one model call, per press.`

Replace everything from `let candidates;` to the closing brace of `findVenuesAction` with:

```ts
  let scouted;
  try {
    scouted = await scoutVenues({
      type: event.type,
      guestCount: event.guestCount,
      vibe: event.vibe,
      city: event.city,
    });
  } catch {
    // Apple Maps and Google Places are third parties Hosty doesn't control
    // — a failed call must never surface as a 500, just as "nothing to show
    // right now."
    return { message: "Venue search isn't answering right now." };
  }

  const centre = CITY_CENTERS[event.city];
  const at = { lat: event.lat ?? centre.lat, lng: event.lng ?? centre.lng };
  const freeRoom = closestFree(scouted.free, at);
  const nothing = { message: "No venues turned up nearby. Add one by hand from Outreach." };
  if (scouted.suitable.length === 0 && !freeRoom) return nothing;

  let ranked: { venues: RankedVenue[]; source: "jev" | "model" | "fallback" } = { venues: [], source: "fallback" };
  if (scouted.suitable.length > 0) {
    const venueAllocation = await db.budgetCategory.findUnique({
      where: { eventId_category: { eventId: event.id, category: "VENUE" } },
    });
    ranked = await rankVenuesForEvent(scouted.suitable, {
      type: event.type,
      city: event.city,
      guestCount: event.guestCount,
      durationHours: event.durationHours,
      date: event.date,
      vibe: event.vibe,
      kind: event.kind,
      lat: at.lat,
      lng: at.lng,
      venueAllocatedCents: venueAllocation?.allocatedCents ?? null,
    }, { eventId: event.id });
  }

  const hostName = user?.name || "the host";
  const found = (venue: VenueResult, reason: string): FoundVenue => ({
    id: venue.id,
    name: venue.name,
    address: venue.address,
    phone: venue.phone,
    website: venue.website,
    lat: venue.lat,
    lng: venue.lng,
    reason,
    subject: composeInquiry(event, { name: venue.name, role: "VENUE" }, hostName).subject,
  });

  // The free room goes last, so it never pushes out a venue that suits.
  const venues = ranked.venues.map((venue) => found(venue, venue.reason));
  if (freeRoom) venues.push(found(freeRoom, FREE_SOURCES[freeRoom.freeSource].reason));
  if (venues.length === 0) return nothing;

  return { source: ranked.source, venues };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/find-venues-action.test.ts tests/unit/venue-discovery.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 5: Run the whole suite and lint**

Run: `npm test && npm run lint`
Expected: all pass. If lint reports thousands of errors under `.claude/worktrees/`, group the output by path: those come from stale worktrees, not this change.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/venues.ts tests/unit/find-venues-action.test.ts
git commit -m "Find venues shows only suitable places, plus the closest free room"
```

- [ ] **Step 7: Check it on the preview deployment**

On the Vercel preview for this branch, signed in, open a test event of type Networking night in Boston with a headcount and budget. Press "Find venues" on the Venues tab and confirm: no nightclubs or sports bars are in the list, and the last card, if one is nearby, is a university, library or community centre with the "may be free" or "often free" reason. Then press "Run again" and confirm Hosty's Overview line reads "I lined up N venues: … (may be free for students). Nothing's been sent." Previews share the production database, so delete the test event afterwards.
