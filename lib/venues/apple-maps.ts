import { importPKCS8, SignJWT } from "jose";
import { CITY_CENTERS, type City } from "@/lib/catalog";

/**
 * Venue search on the web, backed by the Apple Maps Server API — the same
 * data MapKit gives the iOS app, so both platforms find the same places.
 *
 * Needs a Maps key from developer.apple.com (Keys → Maps): the team id, the
 * key id and the .p8 contents. Without them `isVenueSearchConfigured()` is
 * false and the UI falls back to typing an address by hand.
 */

export type VenueResult = {
  /** Provider id; Apple's isn't stable across searches, so it's the name +
   *  coordinate hashed into something the picker can key on. */
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  category: string | null;
};

const TOKEN_URL = "https://maps-api.apple.com/v1/token";
const SEARCH_URL = "https://maps-api.apple.com/v1/search";

export function isVenueSearchConfigured(): boolean {
  return Boolean(
    process.env.APPLE_MAPS_TEAM_ID &&
      process.env.APPLE_MAPS_KEY_ID &&
      process.env.APPLE_MAPS_PRIVATE_KEY,
  );
}

let cachedAccess: { token: string; expiresAt: number } | null = null;

/** A short-lived Maps access token, cached until a minute before expiry. */
async function accessToken(): Promise<string> {
  if (cachedAccess && cachedAccess.expiresAt > Date.now() + 60_000) {
    return cachedAccess.token;
  }
  const teamId = process.env.APPLE_MAPS_TEAM_ID!;
  const keyId = process.env.APPLE_MAPS_KEY_ID!;
  // Vercel env vars flatten newlines; put them back for the PEM parser.
  const pem = process.env.APPLE_MAPS_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");

  const authJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    headers: { Authorization: `Bearer ${authJwt}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apple Maps token: ${res.status}`);
  const data = (await res.json()) as { accessToken: string; expiresInSeconds: number };
  cachedAccess = {
    token: data.accessToken,
    expiresAt: Date.now() + data.expiresInSeconds * 1000,
  };
  return data.accessToken;
}

/** What Apple returns for one place; only the fields we read. */
export type ApplePlace = {
  name?: string;
  coordinate?: { latitude: number; longitude: number };
  formattedAddressLines?: string[];
  poiCategory?: string;
  phoneNumber?: string;
  url?: string;
};

export function normalizePlace(place: ApplePlace): VenueResult | null {
  if (!place.name || !place.coordinate) return null;
  const address = (place.formattedAddressLines ?? []).join(", ");
  return {
    id: `${place.name}@${place.coordinate.latitude.toFixed(5)},${place.coordinate.longitude.toFixed(5)}`,
    name: place.name,
    address,
    phone: place.phoneNumber ?? null,
    website: place.url ?? null,
    lat: place.coordinate.latitude,
    lng: place.coordinate.longitude,
    category: place.poiCategory ?? null,
  };
}

/** Places matching `query` around a city. */
export async function searchVenues(query: string, city: City): Promise<VenueResult[]> {
  const centre = CITY_CENTERS[city];
  const params = new URLSearchParams({
    q: query,
    searchLocation: `${centre.lat},${centre.lng}`,
    userLocation: `${centre.lat},${centre.lng}`,
    resultTypeFilter: "Poi",
    lang: "en-US",
    limitToCountries: "US",
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apple Maps search: ${res.status}`);
  const data = (await res.json()) as { results?: ApplePlace[] };
  return (data.results ?? [])
    .map(normalizePlace)
    .filter((v): v is VenueResult => v !== null)
    .slice(0, 12);
}
