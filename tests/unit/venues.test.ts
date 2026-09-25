import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePlace } from "@/lib/venues/apple-maps";
import {
  GOOGLE_LOCATION_BIAS_RADIUS_METERS,
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_PLACES_SEARCH_URL,
  normalizeGooglePlace,
} from "@/lib/venues/google-maps";
import {
  isVenueSearchConfigured,
  searchVenues,
  venueSearchProvider,
} from "@/lib/venues/search";
import { GET as searchVenuesGet } from "@/app/api/v1/venues/search/route";
import { CITY_CENTERS } from "@/lib/catalog";

const KEYS = [
  "GOOGLE_MAPS_API_KEY",
  "APPLE_MAPS_TEAM_ID",
  "APPLE_MAPS_KEY_ID",
  "APPLE_MAPS_PRIVATE_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function withGoogle() {
  process.env.GOOGLE_MAPS_API_KEY = "test-google-key-not-real";
}

function withApple() {
  process.env.APPLE_MAPS_TEAM_ID = "TEAM123456";
  process.env.APPLE_MAPS_KEY_ID = "KEY1234567";
  process.env.APPLE_MAPS_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----";
}

function replyWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("normalizePlace", () => {
  it("flattens an Apple place into a venue", () => {
    expect(
      normalizePlace({
        name: "The Lantern Roof",
        coordinate: { latitude: 42.3601, longitude: -71.0589 },
        formattedAddressLines: ["12 W 29th St", "Boston, MA 02116", "United States"],
        poiCategory: "Nightlife",
        phoneNumber: "+1 (617) 555-0100",
        url: "https://lantern.example",
      }),
    ).toEqual({
      id: "The Lantern Roof@42.36010,-71.05890",
      name: "The Lantern Roof",
      address: "12 W 29th St, Boston, MA 02116, United States",
      phone: "+1 (617) 555-0100",
      website: "https://lantern.example",
      lat: 42.3601,
      lng: -71.0589,
      category: "Nightlife",
      types: ["Nightlife"],
    });
  });

  it("copes with missing contact details", () => {
    const venue = normalizePlace({
      name: "Somewhere",
      coordinate: { latitude: 1, longitude: 2 },
    });
    expect(venue).toMatchObject({ address: "", phone: null, website: null, category: null });
  });

  it("has no types when Apple gives no category", () => {
    const venue = normalizePlace({ name: "Somewhere", coordinate: { latitude: 1, longitude: 2 } });
    expect(venue?.types).toEqual([]);
  });

  it("drops places with no name or coordinate", () => {
    expect(normalizePlace({ name: "Nameless" })).toBeNull();
    expect(normalizePlace({ coordinate: { latitude: 1, longitude: 2 } })).toBeNull();
  });
});

describe("normalizeGooglePlace", () => {
  it("flattens a Places API (New) result into a venue", () => {
    expect(
      normalizeGooglePlace({
        id: "ChIJLanternRoofBoston",
        displayName: { text: "The Lantern Roof" },
        formattedAddress: "12 W 29th St, Boston, MA 02116, USA",
        internationalPhoneNumber: "+1 617-555-0100",
        nationalPhoneNumber: "(617) 555-0100",
        websiteUri: "https://lantern.example",
        location: { latitude: 42.3601, longitude: -71.0589 },
        primaryType: "bar",
        primaryTypeDisplayName: { text: "Bar" },
      }),
    ).toEqual({
      id: "ChIJLanternRoofBoston",
      name: "The Lantern Roof",
      address: "12 W 29th St, Boston, MA 02116, USA",
      phone: "+1 617-555-0100",
      website: "https://lantern.example",
      lat: 42.3601,
      lng: -71.0589,
      category: "Bar",
      types: ["bar"],
    });
  });

  it("copes with missing contact details and falls back to primaryType", () => {
    const venue = normalizeGooglePlace({
      id: "ChIJSomewhere",
      displayName: { text: "Somewhere" },
      location: { latitude: 1, longitude: 2 },
      primaryType: "night_club",
    });
    expect(venue).toMatchObject({
      address: "",
      phone: null,
      website: null,
      category: "night_club",
    });
  });

  it("hashes name + coordinate when Google omits a place id", () => {
    const venue = normalizeGooglePlace({
      displayName: { text: "Nameless Club" },
      location: { latitude: 42.36, longitude: -71.05 },
    });
    expect(venue?.id).toBe("Nameless Club@42.36000,-71.05000");
  });

  it("drops places with no name or coordinate", () => {
    expect(
      normalizeGooglePlace({
        displayName: { text: "Nameless" },
      }),
    ).toBeNull();
    expect(
      normalizeGooglePlace({
        location: { latitude: 1, longitude: 2 },
      }),
    ).toBeNull();
    expect(
      normalizeGooglePlace({
        displayName: { text: "  " },
        location: { latitude: 1, longitude: 2 },
      }),
    ).toBeNull();
  });

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
});

describe("which provider", () => {
  it("is off when neither is configured", () => {
    expect(isVenueSearchConfigured()).toBe(false);
    expect(venueSearchProvider()).toBeNull();
  });

  it("treats a blank Google key as unset", () => {
    process.env.GOOGLE_MAPS_API_KEY = "   ";
    withApple();
    expect(venueSearchProvider()).toBe("apple");
  });

  it("counts Google alone as configured", () => {
    withGoogle();
    expect(isVenueSearchConfigured()).toBe(true);
    expect(venueSearchProvider()).toBe("google");
  });

  it("counts Apple alone as configured", () => {
    withApple();
    expect(isVenueSearchConfigured()).toBe(true);
    expect(venueSearchProvider()).toBe("apple");
  });

  it("prefers Google when both are set", () => {
    withGoogle();
    withApple();
    expect(venueSearchProvider()).toBe("google");
  });

  it("needs every Apple setting before it counts", () => {
    withApple();
    delete process.env.APPLE_MAPS_PRIVATE_KEY;
    expect(isVenueSearchConfigured()).toBe(false);
  });
});

describe("searchVenues through Google", () => {
  it("asks Google for every place type", () => {
    expect(GOOGLE_PLACES_FIELD_MASK.split(",")).toContain("places.types");
  });

  it("POSTs Text Search (New) biased around the city centre", async () => {
    withGoogle();
    const fetchMock = vi.fn(replyWith({ places: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchVenues("rooftop", "Boston, MA")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_PLACES_SEARCH_URL);
    expect(String(url)).not.toContain("test-google-key");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-google-key-not-real");
    expect(headers["X-Goog-FieldMask"]).toBe(GOOGLE_PLACES_FIELD_MASK);
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(init.body)) as {
      textQuery: string;
      languageCode: string;
      regionCode: string;
      pageSize: number;
      locationBias: { circle: { center: { latitude: number; longitude: number }; radius: number } };
    };
    expect(body.textQuery).toBe("rooftop");
    expect(body.languageCode).toBe("en");
    expect(body.regionCode).toBe("US");
    expect(body.pageSize).toBe(12);
    expect(body.locationBias.circle.center).toEqual({
      latitude: CITY_CENTERS["Boston, MA"].lat,
      longitude: CITY_CENTERS["Boston, MA"].lng,
    });
    expect(body.locationBias.circle.radius).toBe(GOOGLE_LOCATION_BIAS_RADIUS_METERS);
  });

  it("normalizes matching places and drops incomplete ones", async () => {
    withGoogle();
    vi.stubGlobal(
      "fetch",
      replyWith({
        places: [
          {
            id: "ChIJGood",
            displayName: { text: "The Lantern Roof" },
            formattedAddress: "12 W 29th St, Boston, MA 02116, USA",
            location: { latitude: 42.3601, longitude: -71.0589 },
            primaryTypeDisplayName: { text: "Bar" },
          },
          { displayName: { text: "No Pin" } },
        ],
      }),
    );

    await expect(searchVenues("lantern", "Boston, MA")).resolves.toEqual([
      {
        id: "ChIJGood",
        name: "The Lantern Roof",
        address: "12 W 29th St, Boston, MA 02116, USA",
        phone: null,
        website: null,
        lat: 42.3601,
        lng: -71.0589,
        category: "Bar",
        types: [],
      },
    ]);
  });

  it("uses Google even when Apple keys are also set", async () => {
    withGoogle();
    withApple();
    const fetchMock = vi.fn(replyWith({ places: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await searchVenues("loft", "New York, NY");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(GOOGLE_PLACES_SEARCH_URL);
  });

  it("surfaces a failed Places response", async () => {
    withGoogle();
    vi.stubGlobal("fetch", replyWith({ error: { message: "REQUEST_DENIED" } }, 403));
    await expect(searchVenues("bar", "Austin, TX")).rejects.toThrow("Google Places search: 403");
  });

  it("refuses to search when nothing is configured", async () => {
    await expect(searchVenues("bar", "Boston, MA")).rejects.toThrow("Venue search isn't configured");
  });
});

describe("GET /api/v1/venues/search", () => {
  async function get(q: string, city = "Boston, MA") {
    const url = `http://localhost/api/v1/venues/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`;
    return searchVenuesGet(new Request(url));
  }

  it("returns unavailable when no maps key is set", async () => {
    const res = await get("rooftop");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ venues: [], unavailable: true });
  });

  it("returns venues when only Google is configured", async () => {
    withGoogle();
    vi.stubGlobal(
      "fetch",
      replyWith({
        places: [
          {
            id: "ChIJGood",
            displayName: { text: "The Lantern Roof" },
            formattedAddress: "12 W 29th St, Boston, MA 02116, USA",
            location: { latitude: 42.3601, longitude: -71.0589 },
          },
        ],
      }),
    );
    const res = await get("lantern");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      unavailable: false,
      venues: [
        {
          id: "ChIJGood",
          name: "The Lantern Roof",
          address: "12 W 29th St, Boston, MA 02116, USA",
          phone: null,
          website: null,
          lat: 42.3601,
          lng: -71.0589,
          category: null,
          types: [],
        },
      ],
    });
  });

  it("answers empty but available for a one-letter query", async () => {
    withGoogle();
    const res = await get("r");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ venues: [], unavailable: false });
  });
});
