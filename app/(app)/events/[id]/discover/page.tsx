import { requireEvent } from "@/lib/session";
import {
  amenitiesIn,
  loadDiscovery,
  neighborhoodsIn,
  parseFilters,
} from "@/lib/discover";
import { templateFor } from "@/lib/templates";
import { db } from "@/lib/db";
import { DiscoverFilters } from "@/components/discover-filters";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";

export default async function DiscoverPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/discover">) {
  const { id } = await params;
  const query = await searchParams;
  const { event } = await requireEvent(id);

  const filters = parseFilters(query);
  // Flatten to the single-valued shape the filter rail builds URLs from.
  const flatQuery = Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      const single = Array.isArray(value) ? value[0] : value;
      return single === undefined ? [] : [[key, single] as [string, string]];
    }),
  );
  const [
    { scored, totalInCity, savedIds },
    neighborhoods,
    amenities,
    budgetCategories,
  ] =
    await Promise.all([
      loadDiscovery(event, filters),
      neighborhoodsIn(event.city),
      amenitiesIn(event.city),
      db.budgetCategory.findMany({
        where: { eventId: event.id },
        orderBy: { allocatedCents: "desc" },
      }),
    ]);

  // Offer the categories this event's plan actually funds, required first.
  const template = templateFor(event.type);
  const required = new Set(template.required);
  const categories = [
    ...budgetCategories.filter((c) => required.has(c.category)),
    ...budgetCategories.filter((c) => !required.has(c.category)),
  ].map((c) => c.category);

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <DiscoverFilters
          query={flatQuery}
          categories={categories}
          neighborhoods={neighborhoods}
          amenities={amenities}
        />
      </aside>

      <div>
        <p className="mb-5 text-sm text-ink-soft">
          {scored.length} of {totalInCity} in {event.city}, priced for{" "}
          {event.guestCount} guests over {event.durationHours} hours.
        </p>

        {scored.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            body="Try widening the price, or turn off “hide what can’t work” to see the near misses."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {scored.map(({ listing, fit }) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                fit={fit}
                href={`/listings/${listing.id}?event=${event.id}`}
                eventId={event.id}
                saved={savedIds.has(listing.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
