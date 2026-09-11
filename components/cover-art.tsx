import { cx } from "@/components/ui";

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

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Cover treatment for an event — same idea as listing art, no photos. */
export function CoverArt({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const [from, to] = PALETTES[hash(id) % PALETTES.length];
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
        <linearGradient
          id={gradientId}
          gradientTransform={`rotate(${angle + 45})`}
        >
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
    </svg>
  );
}
