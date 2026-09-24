import type { CollaboratorSource } from "@/generated/prisma/enums";
import type { ActivityLine } from "@/lib/activity";
import { db } from "@/lib/db";
import { CITY_CENTERS, isCity } from "@/lib/catalog";
import { composeInquiry, type OutreachEvent } from "@/lib/outreach";
import { rankVenuesForEvent } from "@/lib/ai/venue-rank";
import { venueQueryFor } from "@/lib/venues/query";
import { searchVenues, venueSearchProvider } from "@/lib/venues/search";

/**
 * The agent's venue step: the best few real places for this event, each one
 * added as a VENUE option with the message the host would send already
 * written out.
 *
 * Nothing is sent and nothing is booked — `email` and `sentAt` stay null, so
 * the drafted message is only ever readable from Outreach, where the host
 * presses send themselves. The candidates come from the configured maps
 * provider, never from the model; the model only reorders and explains a
 * fixed list (lib/ai/venue-rank.ts).
 *
 * Idempotent per place id, the same lookup-then-create attachVenueAction uses
 * (lib/actions/venues.ts): externalId also holds catalog listing ids, so
 * there's no unique index to lean on and a second run has to check.
 */

export type VenueStepEvent = OutreachEvent & {
  id: string;
  lat: number | null;
  lng: number | null;
  owner: { name: string | null } | null;
};

/** Which provider answered, in CollaboratorSource's terms. */
function providerSource(): CollaboratorSource {
  return venueSearchProvider() === "google" ? "GOOGLE_MAPS" : "APPLE_MAPS";
}

export async function attachTopVenues(
  event: VenueStepEvent,
  options: { limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<ActivityLine> {
  const limit = options.limit ?? 3;

  // planSteps only reaches this step for a scoutable city; the check is here
  // so searchVenues gets a City rather than a string it can't geocode.
  if (!isCity(event.city)) {
    throw new Error("Hosty doesn't scout that city yet");
  }

  const candidates = await searchVenues(
    venueQueryFor({ type: event.type, guestCount: event.guestCount, vibe: event.vibe }),
    event.city,
  );

  if (candidates.length === 0) {
    return { actor: "agent", kind: "venue_search_empty", title: "No venues turned up nearby" };
  }

  const venueAllocation = await db.budgetCategory.findUnique({
    where: { eventId_category: { eventId: event.id, category: "VENUE" } },
  });

  const centre = CITY_CENTERS[event.city];
  const { venues } = await rankVenuesForEvent(
    candidates,
    {
      type: event.type,
      city: event.city,
      guestCount: event.guestCount,
      durationHours: event.durationHours,
      date: event.date,
      vibe: event.vibe,
      lat: event.lat ?? centre.lat,
      lng: event.lng ?? centre.lng,
      venueAllocatedCents: venueAllocation?.allocatedCents ?? null,
    },
    { fetchImpl: options.fetchImpl, eventId: event.id },
  );

  const top = venues.slice(0, limit);
  const hostName = event.owner?.name ?? "the host";
  const source = providerSource();

  for (const venue of top) {
    const existing = await db.eventCollaborator.findFirst({
      where: { eventId: event.id, kind: "VENUE", externalId: venue.id },
    });
    if (existing) continue;

    await db.eventCollaborator.create({
      data: {
        eventId: event.id,
        kind: "VENUE",
        name: venue.name,
        detail: venue.address || null,
        phone: venue.phone,
        website: venue.website,
        source,
        externalId: venue.id,
        lat: venue.lat,
        lng: venue.lng,
        // Stored so the host reads the agent's exact words before deciding to
        // send them, rather than a message composed fresh at send time.
        // `email` and `sentAt` are left at their null defaults on purpose:
        // there is nowhere for this to go and nothing has gone anywhere.
        message: composeInquiry(event, { name: venue.name, role: "VENUE" }, hostName).body,
      },
    });
  }

  return {
    actor: "agent",
    kind: "venues_attached",
    title: `${top.length} venue${top.length === 1 ? "" : "s"} lined up`,
    body: top.map((venue) => venue.name).join(" · "),
    href: `/events/${event.id}/outreach`,
  };
}
