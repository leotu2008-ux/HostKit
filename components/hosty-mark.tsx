/**
 * Hosty, the event agent: an outline ghost whose last hem bump is a speech
 * tail, with two eyes. Drawn in currentColor so it takes the ink of whatever
 * it sits in. Decorative by default — pass `title` where the mark is the only
 * thing naming Hosty.
 */
export function HostyMark({
  size = 20,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      focusable="false"
      {...a11y}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M22 50 A28 28 0 0 1 78 50 V80 q-7 8 -14 0 t-14 0 t-14 0 L17 94 L22 72 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <ellipse cx={41} cy={52} rx={4} ry={6.5} fill="currentColor" />
      <ellipse cx={59} cy={52} rx={4} ry={6.5} fill="currentColor" />
    </svg>
  );
}
