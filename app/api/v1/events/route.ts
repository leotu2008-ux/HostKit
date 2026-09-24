import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { createEventWithPlan } from "@/lib/event-create";
import { snapQuarterHours } from "@/lib/duration";
import { claimMatches } from "@/lib/drafts";
import { requestDrafts } from "@/lib/api/drafts";
import { apiBearer, apiError, apiUser, json, readJson } from "@/lib/api/http";
import { hasDashboardAccess } from "@/lib/access";
import { currentProfile } from "@/lib/session";
import { canManageClub, managedClubIds } from "@/lib/clubs";
import { afterPublish } from "@/lib/publish";
import { eventInclude, serializeEvent } from "@/lib/api/serialize";

/**
 * The nights this request can manage, oldest first, undated last: everything the
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
  // Fractional since the web got a quarter-hour wheel; iOS still sends whole
  // hours, which this accepts unchanged.
  durationHours: z.number().min(0.25).max(24),
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
 * Creates a night with its plan. Invite-only, the same gate as the website:
 * a session or a bearer token, and `hasDashboardAccess`. Anonymous drafts
 * are disabled for the beta. A device that already holds a claim token
 * still redeems it at POST /api/v1/drafts/claim; this route does not mint one.
 */
export async function POST(request: Request) {
  const bearer = await apiBearer(request);
  const user = bearer ?? (await currentProfile());
  if (!user) return apiError("Sign in first.", 401);
  if (!hasDashboardAccess(user)) return apiError("Join the waitlist.", 403);

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

  if (input.clubId && !(await canManageClub(user.id, input.clubId))) {
    return apiError("You don't run that club.", 403);
  }

  const created = await createEventWithPlan({
    ownerId: user.id,
    clubId: input.clubId ?? null,
    claimToken: null,
    title: input.title,
    type: input.type as EventType,
    date,
    // The wheel's step can't reach a non-web client, so snap here instead: a
    // device that sends 1.4 stores an hour and a half like everyone else.
    durationHours: snapQuarterHours(input.durationHours),
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
    published: input.publish ?? false,
    schoolDomain: user.schoolDomain ?? null,
  });
  // Created live in one step ("Publish now") is still a first publish: the
  // club's followers hear about it just as they would via /publish.
  if (input.publish) await afterPublish(created.id);

  const full = await db.event.findUniqueOrThrow({ where: { id: created.id }, include: eventInclude });
  return json({ event: serializeEvent(full, 0, true) }, 201);
}
