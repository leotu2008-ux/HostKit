import { db } from "@/lib/db";
import { isViable, scoreListing, type ListingFit } from "@/lib/scoring";
import { bookingPosition } from "@/lib/templates";
import { planningContext } from "@/lib/event-context";
import type { DiscoverFilters } from "@/lib/discover-options";

export * from "@/lib/discover-options";

export type ScoredListing = {
  listing: Awaited<ReturnType<typeof db.listing.findMany>>[number];
  fit: ListingFit;
};

/**
 * Loads the catalog for one event and scores every listing against it.
 *
 * Structured constraints (city, category, amenity) are pushed into Postgres.
 * Price filtering and sorting happen in JS afterwards, because the price that
 * matters is the one computed for THIS event — an hourly venue and a
 * per-person caterer cannot be compared, or filtered, on their headline rates.
 * At catalog scale (tens of listings per city) that is the right trade; a
 * catalog in the tens of thousands would want the per-event price precomputed.
 */
export async function loadDiscovery(
  event: {
    id: string;
    city: string;
    guestCount: number;
    durationHours: number;
    date: Date | null;
  },
  filters: DiscoverFilters,
) {
  const [listings, budgetCategories, saved, scorable] = await Promise.all([
    db.listing.findMany({
      where: {
        city: event.city,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.amenity ? { amenities: { has: filters.amenity } } : {}),
        ...(filters.neighborhood
          ? { neighborhood: filters.neighborhood }
          : {}),
      },
    }),
    db.budgetCategory.findMany({ where: { eventId: event.id } }),
    db.savedListing.findMany({
      where: { eventId: event.id },
      select: { listingId: true },
    }),
    planningContext(event),
  ]);
  const savedIds = new Set(saved.map((s) => s.listingId));

  const allocationByCategory = new Map(
    budgetCategories.map((c) => [c.category, c.allocatedCents]),
  );
  let scored: ScoredListing[] = listings.map((listing) => ({
    listing,
    fit: scoreListing(
      listing,
      scorable,
      allocationByCategory.get(listing.category) ?? null,
    ),
  }));

  if (filters.maxCents !== null) {
    scored = scored.filter((s) => s.fit.estimatedCents <= filters.maxCents!);
  }
  if (filters.hideUnfit) {
    scored = scored.filter((s) => isViable(s.fit));
  }

  scored.sort((a, b) => {
    switch (filters.sort) {
      case "price_asc":
        return a.fit.estimatedCents - b.fit.estimatedCents;
      case "price_desc":
        return b.fit.estimatedCents - a.fit.estimatedCents;
      case "rating":
        return (b.listing.rating ?? 0) - (a.listing.rating ?? 0);
      default:
        // Ties on score break on what a host should lock in first — a venue
        // ahead of the invitations — and only then on price. Sorting ties by
        // price alone put the cheapest category at the top of an unfiltered
        // search, which is true but useless.
        return (
          b.fit.score - a.fit.score ||
          bookingPosition(b.listing.category) -
            bookingPosition(a.listing.category) ||
          a.fit.estimatedCents - b.fit.estimatedCents
        );
    }
  });

  return { scored, totalInCity: listings.length, savedIds, scorable };
}

/** Distinct neighborhoods available in a city, for the filter rail. */
export async function neighborhoodsIn(city: string): Promise<string[]> {
  const rows = await db.listing.findMany({
    where: { city, neighborhood: { not: null } },
    select: { neighborhood: true },
    distinct: ["neighborhood"],
    orderBy: { neighborhood: "asc" },
  });
  return rows.map((r) => r.neighborhood!).filter(Boolean);
}

/** Amenities present in a city, most common first. */
export async function amenitiesIn(city: string): Promise<string[]> {
  const rows = await db.listing.findMany({
    where: { city },
    select: { amenities: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const amenity of row.amenities) {
      counts.set(amenity, (counts.get(amenity) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([amenity]) => amenity);
}
