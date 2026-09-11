import { z } from "zod";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { createEventWithPlan } from "@/lib/event-create";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";

/** Every night the signed-in host owns, soonest first. */
export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);

  const events = await db.event.findMany({
    where: { ownerId: user.id },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { name: true } }, ...goingCount },
  });

  return json({
    events: events.map((event) =>
      serializeEvent(event, event._count.guests, user.id),
    ),
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

/** Creates a night, with its plan, owned by the signed-in host. */
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);

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

  const created = await createEventWithPlan({
    ownerId: user.id,
    claimToken: null,
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
    published: input.publish ?? false,
  });

  return json(
    {
      event: serializeEvent(
        { ...created, owner: { name: user.name } },
        0,
        user.id,
      ),
    },
    201,
  );
}
