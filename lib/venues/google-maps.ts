import { CITY_CENTERS, type City } from "@/lib/catalog";
import type { VenueResult } from "@/lib/venues/types";

/**
 * Venue search on the web, backed by Google Places API (New) Text Search.
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Needs `GOOGLE_MAPS_API_KEY` and Places API (New) enabled on the Google
 * Cloud project. Field masks are required; requesting phone/website uses
 * the Text Search Enterprise SKU.
 */

export const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/** Fields that flatten into VenueResult. Phone and website are Enterprise. */
export const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.primaryType",
  "places.primaryTypeDisplayName",
].join(",");

/** Same 40 km window the iOS MapKit search uses. Google's circle cap is 50 km. */
export const GOOGLE_LOCATION_BIAS_RADIUS_METERS = 40_000;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

/** What Text Search (New) returns for one place; only the fields we read. */
export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
};

function hasCoordinate(
  location: GooglePlace["location"],
): location is { latitude: number; longitude: number } {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location?.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

export function normalizeGooglePlace(place: GooglePlace): VenueResult | null {
  const name = place.displayName?.text?.trim();
  if (!name || !hasCoordinate(place.location)) return null;
  const { latitude, longitude } = place.location;
  return {
    id: place.id?.trim() || `${name}@${latitude.toFixed(5)},${longitude.toFixed(5)}`,
    name,
    address: place.formattedAddress?.trim() ?? "",
    phone: place.internationalPhoneNumber?.trim() || place.nationalPhoneNumber?.trim() || null,
    website: place.websiteUri?.trim() || null,
    lat: latitude,
    lng: longitude,
    category: place.primaryTypeDisplayName?.text?.trim() || place.primaryType?.trim() || null,
  };
}

/** Places matching `query` around a city. */
export async function searchGoogleVenues(query: string, city: City): Promise<VenueResult[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps isn't configured");
  const centre = CITY_CENTERS[city];
  const res = await fetch(GOOGLE_PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "en",
      regionCode: "US",
      pageSize: 12,
      locationBias: {
        circle: {
          center: { latitude: centre.lat, longitude: centre.lng },
          radius: GOOGLE_LOCATION_BIAS_RADIUS_METERS,
        },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Places search: ${res.status}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map(normalizeGooglePlace)
    .filter((v): v is VenueResult => v !== null)
    .slice(0, 12);
}
