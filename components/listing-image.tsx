import type { ListingCategory } from "@/generated/prisma/enums";
import { cx } from "@/components/ui";

/**
 * Listing artwork, generated locally and deterministically from the listing id.
 *
 * A real product would show photographs here. This one ships without them on
 * purpose: the catalog is invented sample data, so there is no honest photo to
 * attach to an invented business, and hotlinking stock images would leave the
 * grid full of broken boxes the moment a CDN or network policy disagreed.
 *
 * The palette is drawn from the app's own warm range rather than random hues,
 * so a wall of these reads as a designed grid instead of noise. Same listing,
 * same artwork, every time.
 */

const PALETTES: Array<[string, string]> = [
  ["#c4502e", "#e8a87c"],
  ["#2a4a40", "#7ba394"],
  ["#9a6b10", "#e3c07b"],
  ["#6b4a7a", "#c4a3d4"],
  ["#1f4b63", "#83b4c9"],
  ["#8e3a4a", "#d99aa6"],
  ["#4a5a2a", "#adc17f"],
  ["#a0522d", "#e0b08a"],
];

/** Stable, well-distributed hash so neighbouring cuids don't share a palette. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A simple mark per category, so a caterer never looks like a florist. */
const GLYPH: Record<ListingCategory, string> = {
  VENUE: "M8 44V22l16-12 16 12v22H28V32h-8v12z",
  CATERING: "M12 18h24a12 12 0 0 1-24 0zM8 40h32M24 30v10",
  PHOTOGRAPHY: "M6 16h10l3-4h10l3 4h10v22H6zM24 34a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  VIDEOGRAPHY: "M6 16h24v18H6zM30 22l12-6v22l-12-6z",
  FLORALS: "M24 26a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM24 26v18M24 32c-6 0-10-4-10-4M24 32c6 0 10-4 10-4",
  MUSIC_DJ: "M18 36a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM23 31V12l16-4v19M39 31a5 5 0 1 1-10 0 5 5 0 0 1 10 0z",
  AV_PRODUCTION: "M10 14h28v20H10zM20 40h8M24 34v6",
  RENTALS: "M10 20h28v4H10zM14 24v16M34 24v16M10 40h28",
  BAR_SERVICE: "M12 12h24L24 28zM24 28v12M16 40h16",
  CAKE_DESSERT: "M10 40V28h28v12zM14 28v-6M24 28v-8M34 28v-6M10 34h28",
  TRANSPORT: "M8 30h32v8H8zM12 30l4-10h16l4 10M14 38v4M34 38v4",
  STAFFING: "M24 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 40c0-8 6-12 14-12s14 4 14 12",
  DECOR_STYLING: "M24 8l4 12 12 4-12 4-4 12-4-12-12-4 12-4z",
  INVITATIONS: "M8 14h32v20H8zM8 14l16 12 16-12",
};

export function ListingImage({
  listingId,
  category,
  name,
  className,
}: {
  listingId: string;
  category: ListingCategory;
  name: string;
  className?: string;
}) {
  const [from, to] = PALETTES[hash(listingId) % PALETTES.length];
  const angle = (hash(listingId + category) % 60) - 30;
  const gradientId = `g-${listingId}`;

  return (
    <svg
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className={cx("block h-full w-full", className)}
      role="img"
      aria-label={`Artwork for ${name}`}
    >
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${angle + 45})`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`${gradientId}-h`} cx="28%" cy="22%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${gradientId})`} />
      <rect width="400" height="260" fill={`url(#${gradientId}-h)`} />
      {/* Glyphs are authored in a 48x48 box; scale it to read at card size. */}
      <g
        transform="translate(104 34) scale(4)"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.42"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={GLYPH[category]} />
      </g>
    </svg>
  );
}
