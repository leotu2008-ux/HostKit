/**
 * Discovery filter vocabulary and URL parsing.
 *
 * Deliberately free of any database import: the filter rail is a client
 * component, and importing lib/discover.ts there would drag the Postgres
 * driver into the browser bundle.
 */
import type { ListingCategory } from "@/generated/prisma/enums";
import { ALL_CATEGORIES } from "@/lib/catalog";

export const SORTS = {
  fit: "Best fit for you",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Best reviewed",
} as const;

export type SortKey = keyof typeof SORTS;

export type DiscoverFilters = {
  category: ListingCategory | null;
  maxCents: number | null;
  amenity: string | null;
  neighborhood: string | null;
  sort: SortKey;
  hideUnfit: boolean;
};

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): DiscoverFilters {
  const one = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawCategory = one("category");
  const rawSort = one("sort");
  const rawMax = one("max");
  const maxDollars = rawMax ? Number(rawMax) : NaN;

  return {
    category:
      rawCategory && ALL_CATEGORIES.includes(rawCategory as ListingCategory)
        ? (rawCategory as ListingCategory)
        : null,
    maxCents:
      Number.isFinite(maxDollars) && maxDollars > 0
        ? Math.round(maxDollars * 100)
        : null,
    amenity: one("amenity") || null,
    neighborhood: one("hood") || null,
    sort: rawSort && rawSort in SORTS ? (rawSort as SortKey) : "fit",
    hideUnfit: one("unfit") !== "show",
  };
}

