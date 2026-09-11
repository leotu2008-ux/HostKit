"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nearestCity } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";

/**
 * Asks the browser where it is, once, and remembers the nearest known city
 * so Discover opens on it. Renders nothing. A denied prompt just leaves the
 * page on its current city; the chips are always there as an override.
 */
export function CityDetector() {
  const router = useRouter();

  useEffect(() => {
    if (document.cookie.includes(`${CITY_COOKIE}=`) || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude) ?? "none";
        document.cookie = `${CITY_COOKIE}=${encodeURIComponent(city)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        if (city !== "none") router.refresh();
      },
      () => {
        // Denied or unavailable: don't ask again this month.
        document.cookie = `${CITY_COOKIE}=none; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      },
      { timeout: 8_000, maximumAge: 600_000 },
    );
  }, [router]);

  return null;
}
