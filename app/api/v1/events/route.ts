import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { createEventWithPlan } from "@/lib/event-create";
import { claimMatches, newClaimToken } from "@/lib/drafts";
import { requestDrafts } from "@/lib/api/drafts";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { canManageClub, managedClubIds } from "@/lib/clubs";
import { afterPublish } from "@/lib/publish";
import { eventInclude, serializeEvent } from "@/lib/api/serialize";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * The nights this request can manage, soonest first: everything the
 * signed-in host owns, plus any unclaimed drafts the device holds tokens for.
 */
export async function GET(request: Request) {
  const user = await apiUser(request);
  const drafts = requestDrafts(request);
  if (!user && drafts.length === 0) return apiError("Sign in first.", 401);

  const clubIds = await managedClubIds(user?.id ?? null);
  const events = await db.event.findMany({
    where: {
      OR: [
        ...(user ? [{ ownerId: user.id }] : []),
        ...(clubIds.length > 0 ? [{ clubId: { in: clubIds } }] : []),
        ...(drafts.length > 0
          ? [{ id: { in: drafts.map((d) => d.id) }, ownerId: null }]
          : []),
      ],
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    include: eventInclude,
  });

  return json({
    events: events
      // A draft id alone isn't enough; the token has to match too.
      .filter(
        (event) =>
          (user && event.ownerId === user.id) ||
          (event.clubId !== null && clubIds.includes(event.clubId)) ||
          claimMatches(drafts, event.id, event.claimToken),
      )
      .map((event) => serializeEvent(event, event._count.guests, true)),
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Name this night.").max(120),
  type: z.enum(ALL_EVENT_TYPES as [string, ...string[]]),
  startsAt: z.string().nullable().optional(),
  durationHours: z.number().int().min(1).max(24),
  capacity: z.number().int().min(1).max(100_000),
  city: z.enum(CITIES as unknown as [string, ...string[]]),
  address: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  ticketType: z.enum(["FREE", "PAID"]),
  ticketPriceCents: z.number().int().min(0).max(10_000_000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
  budgetCents: z.number().int().min(0).max(1_000_000_000).optional(),
  publish: z.boolean().optional(),
  /** Post as a club the signed-in host manages. */
  clubId: z.string().min(1).nullable().optional(),
  /** A place picked from MapKit / Apple Maps. Optional. */
  venue: z
    .object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(300).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      website: z.string().trim().max(300).nullable().optional(),
      externalId: z.string().trim().max(200).nullable().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Creates a night with its plan. Signed in, the host owns it. Signed out, it
 * is a draft: the response includes a claim token the device must keep and
 * send back (see lib/api/drafts.ts) to manage it, and publishing waits until
 * the host signs in.
 */
export async function POST(request: Request) {
  const user = await apiUser(request);

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  }
  const input = parsed.data;

  let date: Date | null = null;
  if (input.startsAt) {
    date = new Date(input.startsAt);
    if (Number.isNaN(date.getTime())) {
      return apiError("That start time doesn't look right.", 400);
    }
  }

  const ticketPriceCents =
    input.ticketType === "PAID" ? (input.ticketPriceCents ?? 0) : 0;
  if (input.ticketType === "PAID" && ticketPriceCents === 0) {
    return apiError("Add a ticket price, or make the night free.", 400);
  }

  const claimToken = user ? null : newClaimToken();
  if (!user) {
    // Drafts without an account are cheap to make: a few an hour per address.
    try {
      await assertRateLimit(`draft:ip:${clientIp(request.headers)}`, ...LIMITS.draft.perIp);
    } catch (error) {
      if (error instanceof RateLimitError) return apiError(error.message, 429);
      throw error;
    }
  }

  if (input.clubId && !(user && (await canManageClub(user.id, input.clubId)))) {
    return apiError("You don't run that club.", 403);
  }

  const created = await createEventWithPlan({
    ownerId: user?.id ?? null,
    clubId: input.clubId ?? null,
    claimToken,
    title: input.title,
    type: input.type as EventType,
    date,
    durationHours: input.durationHours,
    guestCount: input.capacity,
    city: input.city,
    address: input.address || null,
    lat: null,
    lng: null,
    venue: input.venue
      ? {
          name: input.venue.name,
          address: input.venue.address || null,
          phone: input.venue.phone || null,
          website: input.venue.website || null,
          externalId: input.venue.externalId || null,
          lat: input.venue.lat ?? null,
          lng: input.venue.lng ?? null,
          source: "APPLE_MAPS",
        }
      : null,
    budgetTotalCents: input.budgetCents ?? 0,
    description: input.description || null,
    ticketType: input.ticketType,
    ticketPriceCents,
    visibility: input.visibility,
    // Publishing is the one step that needs an account.
    published: user ? (input.publish ?? false) : false,
    schoolDomain: user?.schoolDomain ?? null,
  });
  // Created live in one step ("Publish now") is still a first publish: the
  // club's followers hear about it just as they would via /publish.
  if (user && input.publish) await afterPublish(created.id);

  const full = await db.event.findUniqueOrThrow({ where: { id: created.id }, include: eventInclude });
  return json(
    {
      event: serializeEvent(full, 0, true),
      ...(claimToken ? { claimToken } : {}),
    },
    201,
  );
}
