import Link from "next/link";
import { CLUB_CATEGORIES } from "@/lib/club-format";
import { cx } from "@/components/ui";

/** Search box plus category chips for /clubs. Plain GET so the URL is the state. */
export function ClubBrowse({ q, category }: { q: string; category: string | null }) {
  const chipHref = (key: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (key) params.set("category", key);
    const s = params.toString();
    return s ? `/clubs?${s}` : "/clubs";
  };
  return (
    <div className="space-y-3">
      <form method="get" action="/clubs" role="search" className="flex items-center gap-2">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search clubs"
          maxLength={80}
          enterKeyHint="search"
          aria-label="Search clubs"
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-mute focus:border-line-strong focus:outline-none"
        />
        {q ? (
          <Link href={chipHref(null) === "/clubs" ? "/clubs" : `/clubs?category=${category}`} className="shrink-0 text-[13px] font-medium text-ink-soft hover:text-ink">
            Clear
          </Link>
        ) : null}
      </form>
      <nav className="flex flex-wrap gap-1.5" aria-label="Kind of club">
        {[null, ...Object.keys(CLUB_CATEGORIES)].map((key) => {
          const active = key === category;
          return (
            <Link
              key={key ?? "all"}
              href={active && key ? chipHref(null) : chipHref(key)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {key ? CLUB_CATEGORIES[key as keyof typeof CLUB_CATEGORIES] : "All"}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
