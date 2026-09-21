"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentProfile, getCurrentUser, requireEvent, requireUser } from "@/lib/session";
import { createEventWithPlan } from "@/lib/event-create";
import { parseCents } from "@/lib/money";
import { ALL_EVENT_TYPES, CITIES } from "@/lib/catalog";
import { newClaimToken, rememberDraftClaim } from "@/lib/drafts";
import { publishEvent } from "@/lib/publish";
import { canManageClub } from "@/lib/clubs";
import { venueSearchProvider } from "@/lib/venues/search";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

export type EventFormState = { error?: string } | undefined;

const VISIBILITY = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
const TICKETS = ["FREE", "PAID"] as const;

const schema = z.object({
  type: z.enum(ALL_EVENT_TYPES as [string, ...string[]]),
  title: z.string().trim().min(1, "Name this night.").max(120),
  date: z.string().trim(),
  time: z.string().trim(),
  guestCount: z.coerce.number().int().min(1, "At least one person.").max(100_000),
  durationHours: z.coerce.number().int().min(1).max(24),
  city: z.enum(CITIES as unknown as [string, ...string[]]),
  address: z.string().trim().max(200).optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  budget: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  ticketType: z.enum(TICKETS),
  ticketPrice: z.string().trim().optional(),
  visibility: z.enum(VISIBILITY),
  // Filled by the venue picker when the host chose a place.
  venueName: z.string().trim().max(120).optional(),
  venuePhone: z.string().trim().max(40).optional(),
  venueWebsite: z.string().trim().max(300).optional(),
  venueExternalId: z.string().trim().max(200).optional(),
  // "Post as" — a club the host manages, or empty for themselves.
  clubId: z.string().trim().optional(),
});

function parseCoord(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseStart(date: string, time: string): Date | null {
  if (!date) return null;
  const clock = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  const parsedDate = new Date(`${date}T${clock}:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

export async function createEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await currentProfile();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  let budgetTotalCents = 0;
  if (input.budget) {
    const cents = parseCents(input.budget);
    if (cents === null) return { error: "That planning budget doesn't look right." };
    budgetTotalCents = cents;
  }

  let ticketPriceCents = 0;
  if (input.ticketType === "PAID") {
    const cents = parseCents(input.ticketPrice ?? "");
    if (cents === null || cents === 0) {
      return { error: "Add a ticket price, or switch ticketing to Free." };
    }
    ticketPriceCents = cents;
  }

  const date = parseStart(input.date, input.time);
  if (input.date && !date) {
    return { error: "That date and time don't look right." };
  }

  const type = input.type as (typeof ALL_EVENT_TYPES)[number];
  const lat = parseCoord(input.lat);
  const lng = parseCoord(input.lng);
  const address = input.address || null;
  const claimToken = user ? null : newClaimToken();
  if (!user) {
    // Drafts without an account are cheap to make: a few an hour per address.
    try {
      await assertRateLimit(`draft:ip:${clientIp(await headers())}`, ...LIMITS.draft.perIp);
    } catch (error) {
      if (error instanceof RateLimitError) return { error: error.message };
      throw error;
    }
  }
  const clubId = input.clubId || null;
  if (clubId && !(user && (await canManageClub(user.id, clubId)))) {
    return { error: "You don't run that club." };
  }

  const event = await createEventWithPlan({
    ownerId: user?.id ?? null,
    clubId,
    claimToken,
    title: input.title,
    type,
    date,
    durationHours: input.durationHours,
    guestCount: input.guestCount,
    city: input.city,
    address,
    lat,
    lng,
    budgetTotalCents,
    description: input.description || null,
    ticketType: input.ticketType,
    ticketPriceCents,
    visibility: input.visibility,
    published: false,
    schoolDomain: user?.schoolDomain ?? null,
    venue: input.venueName
      ? {
          name: input.venueName,
          address,
          phone: input.venuePhone || null,
          website: input.venueWebsite || null,
          externalId: input.venueExternalId || null,
          lat,
          lng,
          source: venueSearchProvider() === "google" ? "GOOGLE_MAPS" : "APPLE_MAPS",
        }
      : null,
  });

  if (claimToken) {
    await rememberDraftClaim({ id: event.id, token: claimToken });
  }

  redirect(`/events/${event.id}`);
}

export async function publishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(`/events/${eventId}`)}&publish=1`,
    );
  }
  const { event } = await requireEvent(eventId);
  const profile = await currentProfile();
  await publishEvent({
    eventId: event.id,
    user: { id: user.id, schoolDomain: profile?.schoolDomain ?? null },
    published: true,
  });
  refresh();
}

export async function unpublishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const user = await requireUser(`/events/${eventId}`);
  const { event } = await requireEvent(eventId);
  const profile = await currentProfile();
  await publishEvent({
    eventId: event.id,
    user: { id: user.id, schoolDomain: profile?.schoolDomain ?? null },
    published: false,
  });
  refresh();
}

const VISIBILITY_VALUES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

/** Who can find the night. Changing it doesn't publish or unpublish. */
export async function setVisibilityAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const raw = String(formData.get("visibility") ?? "");
  if (!(VISIBILITY_VALUES as readonly string[]).includes(raw)) return;
  const { event } = await requireEvent(eventId);
  await db.event.update({
    where: { id: event.id },
    data: { visibility: raw as (typeof VISIBILITY_VALUES)[number] },
  });
  refresh();
}

/** Whether registrations wait for the host's approval. */
export async function setApprovalAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const on = String(formData.get("requiresApproval") ?? "") === "on";
  const { event } = await requireEvent(eventId);
  await db.event.update({ where: { id: event.id }, data: { requiresApproval: on } });
  refresh();
}

export async function setPublishedAction(formData: FormData) {
  const published = String(formData.get("published") ?? "") === "on";
  if (published) return publishEventAction(formData);
  return unpublishEventAction(formData);
}
