import { MAP_CAMERA, MAP_FOCUS, SCAN_BAND } from "@/lib/venue-discovery-geometry";

/** Center of the downtown crop: both rivers, the bridges, the whole neighborhood. */
const WIDE_FOCUS = { x: 760, y: 520 } as const;
/** After the venues are marked, still SoHo — a little wider than the lock. */
const RELEASE_FOCUS = { x: 640, y: 430 } as const;

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
 * Zoom into SoHo, hold, then ease back — still inside the downtown crop.
 * Scale never drops to a five-borough view; the widest frame is this neighborhood.
 */
export function discoveryCamera(progress: number): DiscoveryCamera {
  const p = clamp01(progress);
  const { wide, close, release } = MAP_CAMERA;
  if (p < 0.2) {
    const t = ease(p / 0.2);
    return {
      scale: lerp(wide, close, t),
      x: lerp(WIDE_FOCUS.x, MAP_FOCUS.x, t),
      y: lerp(WIDE_FOCUS.y, MAP_FOCUS.y, t),
    };
  }
  if (p < 0.76) {
    return { scale: close, x: MAP_FOCUS.x, y: MAP_FOCUS.y };
  }
  const t = ease((p - 0.76) / 0.24);
  return {
    scale: lerp(close, release, t),
    x: lerp(MAP_FOCUS.x, RELEASE_FOCUS.x, t),
    y: lerp(MAP_FOCUS.y, RELEASE_FOCUS.y, t),
  };
}

export function discoveryPhase(progress: number): DiscoveryPhase {
  const p = clamp01(progress);
  if (p < 0.2) return "zoom";
  if (p < 0.34) return "lock";
  if (p < 0.5) return "scan";
  if (p < 0.78) return "venues";
  return "release";
}

/** 0 before the scan finishes, then each room marks in order. */
export function venueVisibility(progress: number, index: number): number {
  const start = 0.5 + index * 0.06;
  return clamp01((progress - start) / 0.07);
}

/** A band that sweeps Houston toward Canal while the camera is locked. */
export function scanBand(progress: number): { y: number; opacity: number } {
  const t = clamp01((progress - 0.32) / 0.18);
  const opacity = t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
  return { y: lerp(SCAN_BAND.from, SCAN_BAND.to, t), opacity };
}
