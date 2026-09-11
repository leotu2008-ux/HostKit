"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type RegisterState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(120),
});

/**
 * Public registration for a published night. Guests do not need an account —
 * same idea as the RSVP token, but the event page is the invitation.
 */
export async function registerForEventAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      published: true,
      visibility: true,
      ownerId: true,
      guestCount: true,
    },
  });
  if (!event) return { error: "That event isn’t listed anymore." };

  const user = await getCurrentUser();
  const canSee =
    (event.published && event.visibility !== "PRIVATE") ||
    user?.id === event.ownerId;
  if (!canSee) return { error: "That event isn’t listed anymore." };

  const existing = await db.guest.findFirst({
    where: { eventId: event.id, email: parsed.data.email },
  });
  if (existing) {
    await db.guest.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        rsvpStatus: "ATTENDING",
        respondedAt: new Date(),
      },
    });
    refresh();
    return { ok: true };
  }

  const attending = await db.guest.count({
    where: { eventId: event.id, rsvpStatus: "ATTENDING" },
  });
  if (attending >= event.guestCount) {
    return { error: "This night is full. Ask the host about a waitlist." };
  }

  await db.guest.create({
    data: {
      eventId: event.id,
      name: parsed.data.name,
      email: parsed.data.email,
      rsvpStatus: "ATTENDING",
      respondedAt: new Date(),
    },
  });
  refresh();
  return { ok: true };
}
