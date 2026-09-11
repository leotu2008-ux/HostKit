"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { parseGuestList } from "@/lib/guests";

export type GuestFormState = { error?: string; added?: number } | undefined;

const RSVP_STATUSES = ["INVITED", "ATTENDING", "DECLINED", "MAYBE"] as const;

export async function addGuestsAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEvent(eventId);

  const parsed = parseGuestList(String(formData.get("guests") ?? ""));
  if (parsed.length === 0) {
    return { error: "Add at least one name." };
  }

  // Skip anyone already on the list by email, so pasting an updated list
  // twice doesn't duplicate half the guests.
  const existing = await db.guest.findMany({
    where: { eventId, email: { not: null } },
    select: { email: true },
  });
  const known = new Set(existing.map((g) => g.email!.toLowerCase()));

  const fresh = parsed.filter(
    (guest) => !guest.email || !known.has(guest.email.toLowerCase()),
  );
  if (fresh.length === 0) {
    return { error: "Everyone on that list is already invited." };
  }

  await db.guest.createMany({
    data: fresh.map((guest) => ({
      eventId,
      name: guest.name,
      email: guest.email,
    })),
  });

  refresh();
  return { added: fresh.length };
}

const updateSchema = z.object({
  rsvpStatus: z.enum(RSVP_STATUSES),
  plusOnes: z.coerce.number().int().min(0).max(20),
  dietary: z.string().max(300).optional(),
});

export async function updateGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  const parsed = updateSchema.safeParse({
    rsvpStatus: formData.get("rsvpStatus"),
    plusOnes: formData.get("plusOnes") ?? 0,
    dietary: formData.get("dietary") ?? undefined,
  });
  if (!parsed.success) return;

  await db.guest.updateMany({
    where: { id: guestId, eventId },
    data: {
      rsvpStatus: parsed.data.rsvpStatus,
      plusOnes: parsed.data.plusOnes,
      dietary: parsed.data.dietary?.trim() || null,
      respondedAt: parsed.data.rsvpStatus === "INVITED" ? null : new Date(),
    },
  });
  refresh();
}

export async function removeGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  await db.guest.deleteMany({ where: { id: guestId, eventId } });
  refresh();
}

/**
 * The guest's own RSVP, submitted from the public page. Deliberately NOT
 * behind requireEvent: the token IS the authorisation, and a guest must never
 * need an account to reply to an invitation.
 */
export async function submitRsvpAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const token = String(formData.get("token") ?? "");
  const parsed = updateSchema.safeParse({
    rsvpStatus: formData.get("rsvpStatus"),
    plusOnes: formData.get("plusOnes") ?? 0,
    dietary: formData.get("dietary") ?? undefined,
  });
  if (!parsed.success) return { error: "Pick whether you can make it." };
  if (parsed.data.rsvpStatus === "INVITED") {
    return { error: "Pick whether you can make it." };
  }

  const guest = await db.guest.findUnique({ where: { rsvpToken: token } });
  if (!guest) return { error: "This invitation link is no longer valid." };

  await db.guest.update({
    where: { id: guest.id },
    data: {
      rsvpStatus: parsed.data.rsvpStatus,
      // Only an attending guest brings anyone with them.
      plusOnes:
        parsed.data.rsvpStatus === "ATTENDING" ? parsed.data.plusOnes : 0,
      dietary: parsed.data.dietary?.trim() || null,
      respondedAt: new Date(),
    },
  });

  refresh();
  return undefined;
}
