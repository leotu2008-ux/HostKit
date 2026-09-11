import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { createEventWithPlan } from "@/lib/event-create";
import { claimMatches, newClaimToken } from "@/lib/drafts";
import { requestDrafts } from "@/lib/api/drafts";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";

/**
 * The nights this request can manage, soonest first: everything the
 * signed-in host owns, plus any unclaimed drafts the device holds tokens for.
 */
export async function GET(request: Request) {
  const user = await apiUser(request);
  const drafts = requestDrafts(request);
  if (!user && drafts.length === 0) return apiError("Sign in first.", 401);

  const events = await db.event.findMany({
    where: {
      OR: [
        ...(user ? [{ ownerId: user.id }] : []),
        ...(drafts.length > 0
          ? [{ id: { in: drafts.map((d) => d.id) }, ownerId: null }]
          : []),
      ],
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { name: true } }, ...goingCount },
  });

  return json({
    events: events
      // A draft id alone isn't enough; the token has to match too.
      .filter(
        (event) =>
          (user && event.ownerId === user.id) ||
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

  const created = await createEventWithPlan({
    ownerId: user?.id ?? null,
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
    budgetTotalCents: input.budgetCents ?? 0,
    description: input.description || null,
    ticketType: input.ticketType,
    ticketPriceCents,
    visibility: input.visibility,
    // Publishing is the one step that needs an account.
    published: user ? (input.publish ?? false) : false,
  });

  return json(
    {
      event: serializeEvent(
        { ...created, owner: user ? { name: user.name } : null },
        0,
        true,
      ),
      ...(claimToken ? { claimToken } : {}),
    },
    201,
  );
}
