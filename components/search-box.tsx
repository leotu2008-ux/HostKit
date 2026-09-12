import Link from "next/link";
import { cx } from "@/components/ui";

/**
 * Search on Discover. A plain GET form so the query lives in the URL —
 * shareable, back-button friendly, no client JS. The city chip survives.
 */
export function SearchBox({
  q,
  city,
  className,
}: {
  q: string;
  /** The raw `city` query param, so a search keeps the chosen city. */
  city?: string | string[];
  className?: string;
}) {
  const cityValue = Array.isArray(city) ? city[0] : city;
  return (
    <form method="get" action="/discover" role="search" className={cx("flex items-center gap-2", className)}>
      {cityValue ? <input type="hidden" name="city" value={cityValue} /> : null}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search events</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-mute"
        >
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16.5 20.5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search events, hosts, clubs, places"
          maxLength={80}
          enterKeyHint="search"
          className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-[15px] text-ink placeholder:text-ink-mute focus:border-line-strong focus:outline-none"
        />
      </label>
      {q ? (
        <Link
          href={cityValue ? `/discover?city=${encodeURIComponent(cityValue)}` : "/discover"}
          className="shrink-0 rounded-full border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}
