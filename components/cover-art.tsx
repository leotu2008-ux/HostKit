import { cx } from "@/components/ui";
import { GlyphOnCover } from "@/components/event-glyph";
import { DEFAULT_ICON, iconFor, type EventIcon } from "@/lib/event-icon";

/**
 * Two shades per category rather than one, so a feed of thirty basketball
 * fixtures is recognisably athletics without thirty identical rectangles.
 * The id picks which of the pair, the category picks the pair.
 */
const PALETTES: Record<EventIcon, Array<[string, string]>> = {
  athletics: [
    ["#2a4a40", "#7ba394"],
    ["#1f4b3f", "#6f9e86"],
  ],
  meeting: [
    ["#1f4b63", "#83b4c9"],
    ["#25566e", "#8fbcd0"],
  ],
  talk: [
    ["#6b4a7a", "#c4a3d4"],
    ["#5d4370", "#b697c9"],
  ],
  study: [
    ["#3a4a6b", "#9aa9c9"],
    ["#334364", "#8fa0c2"],
  ],
  worship: [
    ["#7a5a2a", "#d4b483"],
    ["#6d5127", "#c9a878"],
  ],
  fitness: [
    ["#8e3a4a", "#d99aa6"],
    ["#7f3444", "#d0919e"],
  ],
  arts: [
    ["#a0522d", "#e0b08a"],
    ["#93492a", "#d7a681"],
  ],
  stage: [
    ["#5a3a6b", "#b596c4"],
    ["#4e3360", "#a98cbb"],
  ],
  food: [
    ["#9a6b10", "#e3c07b"],
    ["#8c610f", "#dbb670"],
  ],
  outdoors: [
    ["#4a5a2a", "#adc17f"],
    ["#415126", "#a3b876"],
  ],
  deadline: [
    ["#7a3b2a", "#d4a08c"],
    ["#6d3526", "#c99682"],
  ],
  career: [
    ["#334a52", "#93aeb6"],
    ["#2c424a", "#89a5ad"],
  ],
  giving: [
    ["#8a3a5e", "#d99ab6"],
    ["#7c3454", "#d091ac"],
  ],
  celebration: [
    ["#c4502e", "#e8a87c"],
    ["#b3472a", "#e09f73"],
  ],
  calendar: [
    ["#4a4a52", "#a8a8b4"],
    ["#42424a", "#9e9eaa"],
  ],
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Cover treatment for an event with no photo — a gradient in its category's
 * colours, with the category's glyph behind where the title sits.
 */
export function CoverArt({
  id,
  title,
  type,
  host,
  className,
}: {
  id: string;
  title: string;
  /** HostKit's own EventType, when the event has one. */
  type?: string | null;
  /** The club or department, which sometimes says more than the title. */
  host?: string | null;
  className?: string;
}) {
  const icon = title || type || host ? iconFor({ title, type, host }) : DEFAULT_ICON;
  const shades = PALETTES[icon];
  const [from, to] = shades[hash(id) % shades.length];
  const angle = (hash(id + "cover") % 60) - 30;
  const gradientId = `ev-${id}`;

  return (
    <svg
      viewBox="0 0 400 225"
      preserveAspectRatio="xMidYMid slice"
      className={cx("block h-full w-full", className)}
      role="img"
      aria-label={`Cover for ${title}`}
    >
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${angle + 45})`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`${gradientId}-h`} cx="30%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${gradientId})`} />
      <rect width="400" height="225" fill={`url(#${gradientId}-h)`} />
      <circle cx="320" cy="48" r="56" fill="#fff" fillOpacity="0.12" />
      <circle cx="40" cy="180" r="70" fill="#000" fillOpacity="0.08" />
      <GlyphOnCover icon={icon} />
    </svg>
  );
}
