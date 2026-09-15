import type { EventIcon } from "@/lib/event-icon";

/**
 * One line drawing per event category, all on a 24x24 grid so they sit at the
 * same optical weight when scaled onto a cover.
 *
 * Deliberately plain: these are watermarks behind a title, not app icons. No
 * fills, one stroke width, round caps. Anything busier competes with the text
 * that sits on top of them.
 */
const PATHS: Record<EventIcon, React.ReactNode> = {
  // A pennant on a post: fixtures, not a specific sport.
  athletics: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3.5L17 12H6" />
    </>
  ),
  // Three around a table.
  meeting: (
    <>
      <circle cx="12" cy="7" r="2.5" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 19a5 5 0 0 1 10 0" />
    </>
  ),
  // A lectern with a speaker's line.
  talk: (
    <>
      <path d="M9 4h9l-1.5 5H9z" />
      <path d="M12 9v11" />
      <path d="M7 20h10" />
    </>
  ),
  // An open book.
  study: (
    <>
      <path d="M12 7v12" />
      <path d="M12 7C10 5.5 7.5 5 4 5v12c3.5 0 6 .5 8 2" />
      <path d="M12 7c2-1.5 4.5-2 8-2v12c-3.5 0-6 .5-8 2" />
    </>
  ),
  // An arch — a chapel window, and neutral across faiths.
  worship: (
    <>
      <path d="M7 21V11a5 5 0 0 1 10 0v10" />
      <path d="M5 21h14" />
      <path d="M12 8v5" />
    </>
  ),
  // A pulse line.
  fitness: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  // A framed picture with a horizon.
  arts: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 15l4-4 3.5 3.5L15 11l5 5" />
      <circle cx="9" cy="9" r="1.2" />
    </>
  ),
  // A single note.
  stage: (
    <>
      <path d="M10 18V6l8-2v12" />
      <circle cx="7.5" cy="18" r="2.5" />
      <circle cx="15.5" cy="16" r="2.5" />
    </>
  ),
  // A cup with steam.
  food: (
    <>
      <path d="M4 10h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 11h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M8 3v3M12 3v3" />
    </>
  ),
  // Two peaks.
  outdoors: (
    <>
      <path d="M3 19l6-9 4 5.5" />
      <path d="M10.5 19l4.5-7 6 7z" />
      <circle cx="7" cy="6" r="2" />
    </>
  ),
  // A clock, for a cut-off rather than a gathering.
  deadline: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M9 2h6" />
    </>
  ),
  // A case.
  career: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </>
  ),
  // A heart in an open hand.
  giving: (
    <>
      <path d="M12 9.5c1-2 4-1.6 4 .8 0 1.8-2.4 3.4-4 4.7-1.6-1.3-4-2.9-4-4.7 0-2.4 3-2.8 4-.8z" />
      <path d="M4 17a8 8 0 0 0 16 0" />
    </>
  ),
  // A sparkle.
  celebration: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
    </>
  ),
  // A plain calendar: nothing was given away.
  calendar: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 3v5M16 3v5" />
    </>
  ),
};

/** The glyph alone, for previews and any caller that wants it inline. */
export function EventGlyph({ icon, className }: { icon: EventIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[icon]}
    </svg>
  );
}

/** The same drawing, positioned for the cover's 400x225 canvas. */
export function GlyphOnCover({ icon }: { icon: EventIcon }) {
  return (
    <g
      transform="translate(200 112.5) scale(3.4) translate(-12 -12)"
      fill="none"
      stroke="#fff"
      strokeOpacity="0.62"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[icon]}
    </g>
  );
}
