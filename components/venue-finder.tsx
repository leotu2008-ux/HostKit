import { isVenueSearchConfigured, searchVenues } from "@/lib/venues/search";
import { venueQueryFor } from "@/lib/venues/query";
import { rankVenuesForEvent } from "@/lib/ai/venue-rank";
import { composeInquiry, type OutreachEvent } from "@/lib/outreach";
import { attachVenueAction } from "@/lib/actions/venues";
import { CITY_CENTERS, EVENT_TYPE_LABEL, isCity } from "@/lib/catalog";
import { db } from "@/lib/db";
import { Button, ButtonLink, Card, EmptyState } from "@/components/ui";

/**
 * Apple Maps candidates for this event, ranked by fit — and, when a model is
 * configured, by judgement on top of that. Hidden, not broken, when there's
 * nothing real to show: search is unconfigured, the event's city isn't one
 * HostKit geocodes, Apple errors, or Apple simply has nothing — all four
 * render the same quiet empty state rather than a 500 or a dead end.
 *
 * Extracted from the old app/(app)/events/[id]/agent/venues/page.tsx (now a
 * redirect to the Venue tab) so the Venue tab can mount it below "Your
 * venue" with no page-level concerns of its own.
 */
export async function VenueFinder({
  event,
  hostName,
}: {
  event: OutreachEvent & { id: string; lat: number | null; lng: number | null };
  hostName: string;
}) {
  const outreachHref = `/events/${event.id}/outreach`;

  const notSwitchedOn = (title: string, body: string) => (
    <EmptyState
      title={title}
      body={body}
      action={
        <ButtonLink href={outreachHref} size="sm">
          Go to Outreach
        </ButtonLink>
      }
    />
  );

  if (!isVenueSearchConfigured() || !isCity(event.city)) {
    return notSwitchedOn(
      "Venue search isn't switched on here",
      "Add a venue by hand from Outreach instead.",
    );
  }

  let candidates;
  try {
    candidates = await searchVenues(
      venueQueryFor({ type: event.type, guestCount: event.guestCount, vibe: event.vibe }),
      event.city,
    );
  } catch {
    // Apple Maps is a third party HostKit doesn't control — a failed call
    // must never surface as a 500, just as "nothing to show right now."
    return notSwitchedOn(
      "Venue search isn't switched on here",
      "Add a venue by hand from Outreach instead.",
    );
  }

  if (candidates.length === 0) {
    return notSwitchedOn(
      "No venues turned up nearby",
      "Add one by hand from Outreach instead.",
    );
  }

  const venueAllocation = await db.budgetCategory.findUnique({
    where: { eventId_category: { eventId: event.id, category: "VENUE" } },
  });

  const centre = CITY_CENTERS[event.city];
  const { venues, source } = await rankVenuesForEvent(candidates, {
    type: event.type,
    city: event.city,
    guestCount: event.guestCount,
    durationHours: event.durationHours,
    date: event.date,
    vibe: event.vibe,
    lat: event.lat ?? centre.lat,
    lng: event.lng ?? centre.lng,
    venueAllocatedCents: venueAllocation?.allocatedCents ?? null,
  });

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-ink-mute">
        {EVENT_TYPE_LABEL[event.type]} for {event.guestCount} in {event.city.split(",")[0]}.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {venues.map((venue) => {
          const contactBits = [
            venue.phone ? { label: venue.phone, href: `tel:${venue.phone.replace(/[^\d+]/g, "")}` } : null,
            venue.website
              ? { label: venue.website.replace(/^https?:\/\//, ""), href: venue.website }
              : null,
          ].filter((bit): bit is { label: string; href: string } => bit !== null);
          const draft = composeInquiry(event, { name: venue.name, role: "VENUE" }, hostName);

          return (
            <Card key={venue.id} className="p-4">
              <p className="font-medium text-ink">{venue.name}</p>
              {venue.address ? <p className="text-[13px] text-ink-soft">{venue.address}</p> : null}
              <p className="mt-1 text-[13px] text-ink-mute">{venue.reason}</p>
              {contactBits.length > 0 ? (
                <p className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
                  {contactBits.map((bit) => (
                    <a
                      key={bit.href}
                      href={bit.href}
                      className="text-clay hover:underline"
                      target={bit.href.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                    >
                      {bit.label}
                    </a>
                  ))}
                </p>
              ) : null}
              <p className="mt-2 text-[13px] text-ink-mute italic">Draft ready: “{draft.subject}”</p>
              <form action={attachVenueAction} className="mt-3">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="name" value={venue.name} />
                <input type="hidden" name="address" value={venue.address} />
                <input type="hidden" name="phone" value={venue.phone ?? ""} />
                <input type="hidden" name="website" value={venue.website ?? ""} />
                <input type="hidden" name="externalId" value={venue.id} />
                <input type="hidden" name="lat" value={venue.lat} />
                <input type="hidden" name="lng" value={venue.lng} />
                <Button type="submit" size="sm">
                  Add and draft a message
                </Button>
              </form>
            </Card>
          );
        })}
      </div>

      <p className="text-[13px] text-ink-mute">
        {source === "model" ? "Ranked for this event." : "Ranked by what fits."}
      </p>
    </div>
  );
}
