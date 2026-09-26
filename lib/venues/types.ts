/**
 * A place the host can pick on Create. Both web providers (Google Places
 * and Apple Maps Server API) flatten into this shape so the form and the
 * API don't care which one answered.
 */
export type VenueResult = {
  /** Provider id. Google Place IDs are stable; Apple's aren't, so Apple
   *  hashes name + coordinate. */
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  category: string | null;
  /** Every type the provider gave: Google's primaryType then its types
   *  (bar, university…), or Apple's poiCategory (Nightlife, University…).
   *  Empty when the provider said nothing, which lib/venues/suitability.ts
   *  reads as "unknown", not "unsuitable". */
  types?: string[];
};
