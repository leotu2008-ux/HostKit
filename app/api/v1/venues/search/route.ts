import { isCity } from "@/lib/catalog";
import { apiError, json } from "@/lib/api/http";
import { isVenueSearchConfigured, searchVenues } from "@/lib/venues/apple-maps";

/**
 * Venues matching `q` around `city`, for the Create form on the web. iOS
 * searches MapKit directly. `unavailable` is true when the server has no
 * Apple Maps key, so the form can offer manual entry instead of an error.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const city = url.searchParams.get("city");
  if (!isCity(city)) return apiError("Pick a city first.", 400);
  if (!isVenueSearchConfigured()) return json({ venues: [], unavailable: true });
  if (q.length < 2) return json({ venues: [], unavailable: false });

  try {
    const venues = await searchVenues(q, city);
    return json({ venues, unavailable: false });
  } catch (error) {
    console.error("[venues] search failed", error);
    return apiError("Venue search isn't answering right now.", 502);
  }
}
