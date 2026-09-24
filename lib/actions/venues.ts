"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { record } from "@/lib/activity";
import { CITY_CENTERS, isCity } from "@/lib/catalog";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";
import { isVenueSearchConfigured, searchVenues } from "@/lib/venues/search";
import { venueQueryFor } from "@/lib/venues/query";
import { rankVenuesForEvent } from "@/lib/ai/venue-rank";
import { composeInquiry } from "@/lib/outreach";

/** One ranked candidate, flattened for the client that renders the card: the
 *  Maps result, the ranker's reason, and the subject line of the draft
 *  attachVenueAction would write. Plain data only — it crosses the server
 *  boundary. */
export type FoundVenue = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  reason: string;
  /** composeInquiry's subject, so the card can say what's ready to send. */
  subject: string;
};

export type FindVenuesState =
  | { venues: FoundVenue[]; source: "model" | "fallback" }
  /** A quiet inline line instead of results — never an error page. */
  | { message: string }
  | undefined;

/**
 * "Find venues" — one paid Maps search and one model call, per press.
 *
 * This used to happen during the Venue tab's render. That was fine while it
 * lived behind an agent card, but Milestone 4 made it one of six primary
 * tabs: every visit, refresh and back-navigation spent money, with no limit
 * and no host intent, and requireEvent admits a signed-out draft holder on a
 * cookie. So the spend moved behind this button, and behind a rate limit
 * asserted before anything paid is touched.
 *
 * Returns candidates for the client to render rather than writing anything:
 * nothing here attaches, sends or spends beyond the search itself — adding a
 * venue is still the host's separate press on attachVenueAction.
 */
export async function findVenuesAction(
  _prev: FindVenuesState,
  formData: FormData,
): Promise<FindVenuesState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event, user } = await requireEvent(eventId);

  // The page doesn't render the form in either case; a POST can still arrive.
  if (!isVenueSearchConfigured() || !isCity(event.city)) {
    return { message: "Venue search isn't switched on here." };
  }

  try {
    await assertRateLimit(`venue:event:${event.id}`, ...LIMITS.venueSearch.perEvent);
    // The actor's own bucket, so one host can't work through every event they
    // own: the address when there's no account to bill it to, the account
    // when there is.
    const [limit, windowMs] = LIMITS.venueSearch.perIp;
    const actorKey = event.ownerId
      ? `venue:user:${event.ownerId}`
      : `venue:ip:${clientIp(await headers())}`;
    await assertRateLimit(actorKey, limit, windowMs);
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    return { message: "Give it a little while before searching again." };
  }

  let candidates;
  try {
    candidates = await searchVenues(
      venueQueryFor({ type: event.type, guestCount: event.guestCount, vibe: event.vibe }),
      event.city,
    );
  } catch {
    // Apple Maps and Google Places are third parties Hosty doesn't control
    // — a failed call must never surface as a 500, just as "nothing to show
    // right now."
    return { message: "Venue search isn't answering right now." };
  }

  if (candidates.length === 0) {
    return { message: "No venues turned up nearby. Add one by hand from Outreach." };
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
  }, { eventId: event.id });

  const hostName = user?.name || "the host";
  return {
    source,
    venues: venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      phone: venue.phone,
      website: venue.website,
      lat: venue.lat,
      lng: venue.lng,
      reason: venue.reason,
      subject: composeInquiry(event, { name: venue.name, role: "VENUE" }, hostName).subject,
    })),
  };
}

/** Re-validates the hidden fields the venues page rendered — a host never
 *  types these, but the form is still a POST from a browser, so the numbers
 *  and lengths get checked the same as any other input. */
const attachSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(300).optional().default(""),
  externalId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * Adds an Apple Maps venue as a VENUE collaborator, in the exact shape
 * lib/event-create.ts:82-97 writes at event creation — email stays null,
 * since Apple Maps never returns one; the host supplies it later from
 * Outreach.
 *
 * Idempotent on externalId: pressing this twice (a slow network, a second
 * tab) must reuse the same collaborator rather than double it up in
 * Outreach. There's no unique index on externalId to lean on for this — the
 * column also holds catalog listing ids from other sources — so it's a
 * lookup-then-create rather than a database constraint.
 */
export async function attachVenueAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  const outreachHref = `/events/${event.id}/outreach`;

  const parsed = attachSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    website: formData.get("website") ?? undefined,
    externalId: formData.get("externalId"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });

  // These fields are hidden inputs the page itself rendered, never typed by
  // hand, so a failure here means the form was tampered with rather than a
  // host mistake — there's nothing to show them, just land back on Outreach.
  if (parsed.success) {
    const data = parsed.data;
    const existing = await db.eventCollaborator.findFirst({
      where: { eventId: event.id, kind: "VENUE", externalId: data.externalId },
    });

    if (!existing) {
      await db.eventCollaborator.create({
        data: {
          eventId: event.id,
          kind: "VENUE",
          name: data.name,
          detail: data.address || null,
          phone: data.phone || null,
          website: data.website || null,
          source: "APPLE_MAPS",
          externalId: data.externalId,
          lat: data.lat,
          lng: data.lng,
        },
      });
      await record(event.id, {
        actor: "host",
        kind: "venue_attached",
        title: `Added ${data.name} as a venue option`,
        href: outreachHref,
      });
    }
  }

  redirect(outreachHref);
}
