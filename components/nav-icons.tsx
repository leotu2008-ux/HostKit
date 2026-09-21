/**
 * The workspace sidebar's icons, one per stage of running a night, plus the
 * two marks the switcher needs.
 *
 * Hand-drawn rather than a library: six 16px glyphs are not worth a
 * dependency, and drawing them here keeps them in the same voice as
 * components/date-tile.tsx and the tab bar — a single-weight outline stroke
 * that inherits its colour from the row it sits in. `aria-hidden` on all of
 * them, so a nav link's accessible name stays its label.
 */

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

/** Overview — four panes of one dashboard. */
export function OverviewIcon() {
  return (
    <Glyph>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Glyph>
  );
}

/** Brief — a sheet with what the agent still needs written on it. */
export function BriefIcon() {
  return (
    <Glyph>
      <path d="M5.5 3.5h9l4 4v13h-13z" />
      <path d="M14 3.5v4.5h4.5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </Glyph>
  );
}

/** Planning — the calendar, with a thing ticked off. */
export function PlanningIcon() {
  return (
    <Glyph>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M9 14.5l2.2 2.2 4-4.2" />
    </Glyph>
  );
}

/** Venue — where the night happens. */
export function VenueIcon() {
  return (
    <Glyph>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Glyph>
  );
}

/** Outreach — a message on its way out. */
export function OutreachIcon() {
  return (
    <Glyph>
      <path d="M21 3.5 2.5 10.5l7 2.5 2.5 7z" />
      <path d="M21 3.5 9.5 13" />
    </Glyph>
  );
}

/** Guests — the people coming. */
export function GuestsIcon() {
  return (
    <Glyph>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 19.5c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 15.4c1.4.7 2.5 2 3 4.1" />
    </Glyph>
  );
}

/** The switcher's disclosure mark. */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}

/** Marks the event you're already in. */
export function CheckIcon() {
  return (
    <Glyph>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Glyph>
  );
}
