import type { City } from "@/lib/catalog";
import { isAppleMapsConfigured, searchAppleVenues } from "@/lib/venues/apple-maps";
import { isGoogleMapsConfigured, searchGoogleVenues } from "@/lib/venues/google-maps";
import type { VenueResult } from "@/lib/venues/types";

/**
 * Web venue search. Google Places wins when `GOOGLE_MAPS_API_KEY` is set;
 * otherwise Apple Maps Server API, if those keys are set. Without either
 * the Create form falls back to typing an address. iOS searches MapKit
 * locally and never comes through here.
 */

export type { VenueResult };
export type VenueSearchProvider = "google" | "apple";

export function venueSearchProvider(): VenueSearchProvider | null {
  if (isGoogleMapsConfigured()) return "google";
  if (isAppleMapsConfigured()) return "apple";
  return null;
}

export function isVenueSearchConfigured(): boolean {
  return venueSearchProvider() !== null;
}

export async function searchVenues(query: string, city: City): Promise<VenueResult[]> {
  const provider = venueSearchProvider();
  if (provider === "google") return searchGoogleVenues(query, city);
  if (provider === "apple") return searchAppleVenues(query, city);
  throw new Error("Venue search isn't configured");
}
