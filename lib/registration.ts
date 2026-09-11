import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";

export type RegistrationResult =
  | { ok: true }
  | { ok: false; code: "not_listed" | "full" | "declined"; error: string };

const NOT_LISTED: RegistrationResult = {
  ok: false,
  code: "not_listed",
  error: "That event isn’t listed anymore.",
};

/**
 * Account-free registration for a published night, shared by the web
 * Register form and the iOS API.
 *
 * Knowing someone's email must not let you rewrite their reply: an existing
 * guest is never renamed, a guest who declined can only change that from
 * their own RSVP link, and flipping an invited guest to attending still has
 * to fit under capacity.
 */
export async function registerGuest(input: {
  eventId: string;
  name: string;
  email: string;
  viewerId: string | null;
}): Promise<RegistrationResult> {
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      published: true,
      visibility: true,
      ownerId: true,
      guestCount: true,
    },
  });
  if (!event) return NOT_LISTED;

  const isOwner = input.viewerId !== null && input.viewerId === event.ownerId;
  if (!isPublicPageVisible(event) && !isOwner) return NOT_LISTED;

  const email = input.email.trim().toLowerCase();
  const existing = await db.guest.findFirst({
    where: { eventId: event.id, email },
  });
  if (existing?.rsvpStatus === "ATTENDING") return { ok: true };
  if (existing?.rsvpStatus === "DECLINED") {
    return {
      ok: false,
      code: "declined",
      error:
        "This email is already on the guest list. Use your invitation link to change your reply.",
    };
  }

  const attending = await db.guest.count({
    where: { eventId: event.id, rsvpStatus: "ATTENDING" },
  });
  if (attending >= event.guestCount) {
    return {
      ok: false,
      code: "full",
      error: "This night is full. Ask the host about a waitlist.",
    };
  }

  if (existing) {
    await db.guest.update({
      where: { id: existing.id },
      data: { rsvpStatus: "ATTENDING", respondedAt: new Date() },
    });
  } else {
    await db.guest.create({
      data: {
        eventId: event.id,
        name: input.name.trim(),
        email,
        rsvpStatus: "ATTENDING",
        respondedAt: new Date(),
      },
    });
  }
  return { ok: true };
}
