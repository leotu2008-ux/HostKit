"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useTransition } from "react";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { SORTS } from "@/lib/discover-options";
import type { ListingCategory } from "@/generated/prisma/enums";
import { Field, Select, cx } from "@/components/ui";

/**
 * Filters live in the URL rather than component state, so a shortlist
 * conversation ("look at this search") survives being pasted to someone else,
 * and the back button does what it should.
 */
export function DiscoverFilters({
  query,
  categories,
  neighborhoods,
  amenities,
}: {
  /** The page's own search params, passed down rather than read from the
   *  client, so the server's parse stays the single source of truth (and the
   *  component needs no Suspense boundary). */
  query: Record<string, string>;
  categories: ListingCategory[];
  neighborhoods: string[];
  amenities: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Every control here is driven by the URL, which only changes after a server
  // round trip. Without an optimistic copy a clicked checkbox visibly snaps
  // back to its old state until the response lands. useOptimistic reverts to
  // the real value automatically once the transition settles.
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(query);
  const current = useMemo(
    () => new URLSearchParams(optimisticQuery),
    [optimisticQuery],
  );

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(current.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      setOptimisticQuery(Object.fromEntries(next));
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => {
      setOptimisticQuery({});
      router.replace("?", { scroll: false });
    });
  }

  const activeCategory = current.get("category") ?? "";
  const hideUnfit = current.get("unfit") !== "show";
  const hasFilters = [...current.keys()].some((k) => k !== "sort");

  return (
    <div
      className={cx("space-y-6 transition-opacity", isPending && "opacity-60")}
    >
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Category</p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={activeCategory === ""}
            onClick={() => update("category", null)}
          >
            Everything
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category}
              active={activeCategory === category}
              onClick={() => update("category", category)}
            >
              {CATEGORY_LABEL[category]}
            </FilterChip>
          ))}
        </div>
      </div>

      <Field label="Sort by">
        <Select
          value={current.get("sort") ?? "fit"}
          onChange={(e) => update("sort", e.target.value)}
        >
          {Object.entries(SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Max cost for this event"
        hint="Total for your headcount and hours, not the hourly rate."
      >
        <Select
          value={current.get("max") ?? ""}
          onChange={(e) => update("max", e.target.value || null)}
        >
          <option value="">Any</option>
          {[1000, 2500, 5000, 10000, 20000, 50000].map((amount) => (
            <option key={amount} value={amount}>
              Up to ${amount.toLocaleString()}
            </option>
          ))}
        </Select>
      </Field>

      {neighborhoods.length > 0 ? (
        <Field label="Neighborhood">
          <Select
            value={current.get("hood") ?? ""}
            onChange={(e) => update("hood", e.target.value || null)}
          >
            <option value="">Anywhere in the city</option>
            {neighborhoods.map((hood) => (
              <option key={hood} value={hood}>
                {hood}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {amenities.length > 0 ? (
        <Field label="Must have">
          <Select
            value={current.get("amenity") ?? ""}
            onChange={(e) => update("amenity", e.target.value || null)}
          >
            <option value="">Anything</option>
            {amenities.map((amenity) => (
              <option key={amenity} value={amenity}>
                {amenity}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={hideUnfit}
          onChange={(e) => update("unfit", e.target.checked ? null : "show")}
          className="mt-0.5 size-4 accent-[var(--color-clay)]"
        />
        <span className="text-sm text-ink">
          Hide what can&rsquo;t work
          <span className="mt-0.5 block text-ink-mute">
            Too small for your guests, or needs more notice than you have.
          </span>
        </span>
      </label>

      {hasFilters ? (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm font-medium text-clay hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-clay bg-clay-wash text-clay-deep"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
