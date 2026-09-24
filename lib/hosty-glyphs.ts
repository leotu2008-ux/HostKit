/**
 * Hosty's outline as plain geometry, for drawing him in characters.
 *
 * The same shape as components/hosty-mark.tsx (a 100×100 viewBox): a dome
 * from (22,50) to (78,50), straight sides down to y=80, a hem of two and a
 * half bumps, and a speech tail out to (17,94). It's sampled into a polygon
 * here, so which grid cells fall inside him is a pure calculation — no
 * canvas needed, and testable.
 */

type Point = readonly [number, number];

/** [cx, cy, rx, ry] of each eye, slightly larger than drawn, so the holes read. */
export const GHOST_EYES: ReadonlyArray<readonly [number, number, number, number]> = [
  [41, 52, 5.4, 7.9],
  [59, 52, 5.4, 7.9],
];

function quad(from: Point, control: Point, to: Point, steps = 8): Point[] {
  const points: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([a * from[0] + b * control[0] + c * to[0], a * from[1] + b * control[1] + c * to[1]]);
  }
  return points;
}

function buildOutline(): Point[] {
  const points: Point[] = [];
  // The dome: centre (50,50), radius 28, from the left side over the top.
  for (let i = 0; i <= 24; i++) {
    const angle = Math.PI + (Math.PI * i) / 24;
    points.push([50 + 28 * Math.cos(angle), 50 + 28 * Math.sin(angle)]);
  }
  points.push([78, 80]);
  // The hem: q-7 8 -14 0, then two smooth continuations (t -14 0).
  points.push(...quad([78, 80], [71, 88], [64, 80]));
  points.push(...quad([64, 80], [57, 72], [50, 80]));
  points.push(...quad([50, 80], [43, 88], [36, 80]));
  // The speech tail, and back up the left side.
  points.push([17, 94], [22, 72]);
  return points;
}

const OUTLINE = buildOutline();

/** Ray casting: is (x, y) inside Hosty's outline? */
export function pointInGhost(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToOutline(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [ax, ay] = OUTLINE[j];
    const [bx, by] = OUTLINE[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

export type GlyphCell = { x: number; y: number; edge: boolean };

/**
 * The character cells inside Hosty, on a grid `step` units tall (characters
 * are narrower than they are tall, so columns are closer together). His eyes
 * are left empty. Cells within about a stroke of the outline are marked
 * `edge`, so they can be drawn solid and keep his silhouette crisp.
 */
export function glyphCells(step: number): GlyphCell[] {
  const cells: GlyphCell[] = [];
  const column = step * 0.62;
  for (let y = 22 + step / 2; y < 96; y += step) {
    for (let x = 14 + column / 2; x < 86; x += column) {
      if (!pointInGhost(x, y)) continue;
      if (GHOST_EYES.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)) continue;
      cells.push({ x, y, edge: distanceToOutline(x, y) < step * 0.8 });
    }
  }
  return cells;
}
