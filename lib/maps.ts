/**
 * Device maps links. `geo:` opens the phone's maps app; the https fallback
 * works on desktop. We never embed a map SDK — the host's own Maps does it.
 */

export type MapTarget = {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
};

export function mapsQuery(target: MapTarget): string {
  const place = (target.address || "").trim();
  const pin = (target.label || place).trim();
  if (
    typeof target.lat === "number" &&
    typeof target.lng === "number" &&
    Number.isFinite(target.lat) &&
    Number.isFinite(target.lng)
  ) {
    return pin ? `${target.lat},${target.lng} (${pin})` : `${target.lat},${target.lng}`;
  }
  return place;
}

/** Opens Apple Maps on iOS, Google Maps on Android, a web map elsewhere. */
export function deviceMapsHref(target: MapTarget): string | null {
  const query = mapsQuery(target);
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  if (
    typeof target.lat === "number" &&
    typeof target.lng === "number" &&
    Number.isFinite(target.lat) &&
    Number.isFinite(target.lng)
  ) {
    return `geo:${target.lat},${target.lng}?q=${encoded}`;
  }
  return `https://maps.google.com/?q=${encoded}`;
}

export function webMapsHref(target: MapTarget): string | null {
  const query = mapsQuery(target);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function hasMapTarget(target: MapTarget): boolean {
  return mapsQuery(target).length > 0;
}
