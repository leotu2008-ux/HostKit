import { MAP_CAMERA, MAP_FOCUS, SCAN_BAND } from "@/lib/venue-discovery-geometry";

/** Downtown crop once the camera has pulled back: rivers, bridges, and the grid. */
const NEIGHBORHOOD_FOCUS = { x: 700, y: 540 } as const;

export type DiscoveryPhase = "zoom" | "lock" | "scan" | "venues" | "release";

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function ease(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type DiscoveryCamera = { scale: number; x: number; y: number };

/**
 * Starts on the blocks in SoHo and zooms out to the neighborhood.
 * The widest frame is still downtown Manhattan, close enough that street lines remain visible.
 */
export function discoveryCamera(progress: number): DiscoveryCamera {
  const p = clamp01(progress);
  const { block, neighborhood } = MAP_CAMERA;
  if (p < 0.3) {
    const t = ease(p / 0.3);
    return {
      scale: lerp(block, neighborhood, t),
      x: lerp(MAP_FOCUS.x, NEIGHBORHOOD_FOCUS.x, t),
      y: lerp(MAP_FOCUS.y, NEIGHBORHOOD_FOCUS.y, t),
    };
  }
  return { scale: neighborhood, x: NEIGHBORHOOD_FOCUS.x, y: NEIGHBORHOOD_FOCUS.y };
}

export function discoveryPhase(progress: number): DiscoveryPhase {
  const p = clamp01(progress);
  if (p < 0.3) return "zoom";
  if (p < 0.42) return "lock";
  if (p < 0.56) return "scan";
  if (p < 0.8) return "venues";
  return "release";
}

/** 0 before the scan finishes, then each room marks in order. */
export function venueVisibility(progress: number, index: number): number {
  const start = 0.5 + index * 0.06;
  return clamp01((progress - start) / 0.07);
}

/** A band that sweeps Houston toward Canal once the neighborhood is in frame. */
export function scanBand(progress: number): { y: number; opacity: number } {
  const t = clamp01((progress - 0.4) / 0.16);
  const opacity = t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
  return { y: lerp(SCAN_BAND.from, SCAN_BAND.to, t), opacity };
}
