"use client";

import { useEffect, useRef, useState } from "react";
import type { VenueResult } from "@/lib/venues/search";
import { Button, cx } from "@/components/ui";

const inputClass =
  "w-full min-h-11 rounded-lg border border-line bg-sunk px-3 text-[15px] text-ink placeholder:text-ink-mute focus:border-clay focus:outline-none";

/**
 * Where the night happens. Search real venues around the city (Google
 * Places on the web, MapKit on iOS) and pick one — it fills the address
 * and becomes a venue the host can contact from the dashboard — or skip
 * it and type an address.
 */
export function VenueField({ city }: { city: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<VenueResult | null>(null);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [manual, setManual] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    // Debounced so typing doesn't fire a search per keystroke.
    timer.current = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/venues/search?city=${encodeURIComponent(city)}&q=${encodeURIComponent(q)}`,
        );
        const data = (await res.json()) as {
          venues?: VenueResult[];
          unavailable?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Search failed.");
        setUnavailable(Boolean(data.unavailable));
        setResults(data.venues ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, city]);

  function pick(venue: VenueResult) {
    setPicked(venue);
    setAddress(venue.address);
    setLat(String(venue.lat));
    setLng(String(venue.lng));
    setResults([]);
    setQuery("");
  }

  function clearPick() {
    setPicked(null);
    setAddress("");
    setLat("");
    setLng("");
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">Venue</span>
        <span className="mb-2 block text-[13px] text-ink-mute">
          Optional. Search places around {city.split(",")[0]} — picking one adds it
          to your outreach list — or skip this if you already have somewhere.
        </span>
      </div>

      {picked ? (
        <div className="flex items-start gap-3 rounded-lg border border-clay/40 bg-clay-wash/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{picked.name}</p>
            <p className="truncate text-[13px] text-ink-soft">{picked.address}</p>
            {picked.phone || picked.website ? (
              <p className="truncate text-[13px] text-ink-mute">
                {[picked.phone, picked.website].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={clearPick} className="text-sm font-medium text-ink-soft hover:text-ink">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search venues — “loft”, “rooftop”, a bar name…"
            aria-label="Search venues"
            className={inputClass}
          />
          {searching ? (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-ink-mute">
              Searching…
            </span>
          ) : null}
          {results.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface shadow-[0_12px_40px_rgb(0_0_0/0.12)]">
              {results.map((venue) => (
                <li key={venue.id}>
                  <button
                    type="button"
                    onClick={() => pick(venue)}
                    className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-sunk"
                  >
                    <span className="font-medium text-ink">{venue.name}</span>
                    <span className="text-[13px] text-ink-soft">{venue.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {unavailable ? (
        <p className="text-[13px] text-amber">
          Venue search isn’t set up on this server. Type the address below instead.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!picked && !manual ? (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-sm font-medium text-clay hover:underline"
        >
          I already have a venue — type the address
        </button>
      ) : null}

      <div className={cx(!manual && !picked && "hidden")}>
        <span className="mb-1.5 block text-sm font-medium text-ink">Address</span>
        <input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          placeholder="200 Kent Ave, Brooklyn, NY"
          className={inputClass}
        />
        <span className="mt-1.5 block text-[13px] text-ink-mute">
          Street and city, so guests can open it in their Maps app.
        </span>
      </div>

      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <input type="hidden" name="venueName" value={picked?.name ?? ""} />
      <input type="hidden" name="venuePhone" value={picked?.phone ?? ""} />
      <input type="hidden" name="venueWebsite" value={picked?.website ?? ""} />
      <input type="hidden" name="venueExternalId" value={picked?.id ?? ""} />
      {!picked && manual ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setManual(false)}>
          Search venues instead
        </Button>
      ) : null}
    </div>
  );
}
