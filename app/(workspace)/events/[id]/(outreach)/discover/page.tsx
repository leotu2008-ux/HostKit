import { requireEvent } from "@/lib/session";
import {
  amenitiesIn,
  loadDiscovery,
  neighborhoodsIn,
  parseFilters,
} from "@/lib/discover";
import { templateFor } from "@/lib/templates";
import { db } from "@/lib/db";
import { isCity } from "@/lib/catalog";
import { formatDurationLong } from "@/lib/when";
import { DiscoverFilters } from "@/components/discover-filters";
import { ListingCard } from "@/components/listing-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export default async function DiscoverPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/discover">) {
  const { id } = await params;
  const query = await searchParams;
  const { event } = await requireEvent(id);

  // Scouting needs a city to search in; a blank/incomplete brief has none yet.
  if (!isCity(event.city)) {
    return (
      <EmptyState
        title="Finish the brief first"
        body="Tell the agent the city and it can scout vendors."
        action={
          <ButtonLink href={`/events/${event.id}/brief`}>Finish the brief</ButtonLink>
        }
      />
    );
  }

  const filters = parseFilters(query);
  const activeFilterCount =
    [filters.category, filters.maxCents, filters.neighborhood, filters.amenity]
      .filter((v) => v !== null).length + (filters.hideUnfit ? 0 : 1);
  // Flatten to the single-valued shape the filter rail builds URLs from.
  const flatQuery = Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      const single = Array.isArray(value) ? value[0] : value;
      return single === undefined ? [] : [[key, single] as [string, string]];
    }),
  );
  const [
    { scored, totalInCity, savedIds, scorable },
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
    <div className="space-y-6">
      {/* The app is a phone-width column at every viewport, so the filter
          rail can't sit beside the results. Collapsed by default — a host
          should see venues first, not eight controls — and held open while
          any filter is active, so picking one doesn't slam the panel shut on
          the re-render. */}
      <details
        open={activeFilterCount > 0 || filters.sort !== "fit"}
        className="group rounded-xl border border-line bg-surface"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-clay-wash px-2 py-0.5 text-xs text-clay-deep">
                {activeFilterCount} on
              </span>
            ) : null}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="text-ink-mute transition-transform group-open:rotate-180"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="border-t border-line px-4 py-4">
          <DiscoverFilters
            query={flatQuery}
            categories={categories}
            neighborhoods={neighborhoods}
            amenities={amenities}
          />
        </div>
      </details>

      <div>
        <p className="mb-5 text-sm text-ink-soft">
          {scored.length} of {totalInCity} in {event.city}, priced for{" "}
          {scorable.guestCount} guests over {formatDurationLong(event.durationHours)}
          {scorable.headSource === "rsvp" ? " (from your RSVPs)" : ""}.
        </p>

        {scored.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            body="Try widening the price, or turn off “hide what can’t work” to see the near misses."
          />
        ) : (
          <div className="grid gap-5">
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
