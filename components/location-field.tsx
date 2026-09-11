"use client";

import { useState } from "react";
import { Field, Input, Button } from "@/components/ui";

export function LocationField({
  defaultAddress,
  defaultLat,
  defaultLng,
}: {
  defaultAddress?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
}) {
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [lat, setLat] = useState(defaultLat?.toString() ?? "");
  const [lng, setLng] = useState(defaultLng?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  function pinHere() {
    if (!navigator.geolocation) {
      setError("This browser can't share a location.");
      return;
    }
    setError(null);
    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setPinning(false);
      },
      () => {
        setError("Couldn't read this device's location.");
        setPinning(false);
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Where is it?"
        hint="Street and city, so guests can open it in their Maps app."
      >
        <Input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          placeholder="200 Kent Ave, Brooklyn, NY"
        />
      </Field>
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={pinHere}
          disabled={pinning}
        >
          {pinning ? "Finding you…" : "Use this device's location"}
        </Button>
        {lat && lng ? (
          <p className="text-[13px] text-forest">Pinned on the map.</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
