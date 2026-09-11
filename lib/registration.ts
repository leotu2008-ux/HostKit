import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";

export type RegistrationResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_listed" | "full" | "declined" | "sign_in";
      error: string;
    };

const NOT_LISTED: RegistrationResult = {
  ok: false,
  code: "not_listed",
  error: "That event isn’t listed anymore.",
};

export type Registrant = { id: string; name: string; email: string };

/**
 * Registration for a published night, shared by the web Register button and
 * the iOS API.
 *
 * Registering needs an account: the guest row carries the account's id and
 * email, which is what blasts go to. Names the host added by hand stay
 * account-less rows on the same list.
 *
 * An existing row is never renamed, a guest who declined can only change
 * that from their own RSVP link, and flipping an invited guest to attending
 * still has to fit under capacity.
 */
export async function registerGuest(input: {
  eventId: string;
  viewer: Registrant | null;
}): Promise<RegistrationResult> {
  if (!input.viewer) {
    return { ok: false, code: "sign_in", error: "Sign in to register." };
  }

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

  const isOwner = input.viewer.id === event.ownerId;
  if (!isPublicPageVisible(event) && !isOwner) return NOT_LISTED;

  const email = input.viewer.email.trim().toLowerCase();
  // Match by account first, then by email so a name the host typed in
  // beforehand becomes that person's registration rather than a duplicate.
  const existing =
    (await db.guest.findFirst({ where: { eventId: event.id, userId: input.viewer.id } })) ??
    (await db.guest.findFirst({ where: { eventId: event.id, email } }));
  if (existing?.rsvpStatus === "ATTENDING") {
    if (!existing.userId) {
      await db.guest.update({ where: { id: existing.id }, data: { userId: input.viewer.id } });
    }
    return { ok: true };
  }
  if (existing?.rsvpStatus === "DECLINED") {
    return {
      ok: false,
      code: "declined",
      error:
        "You’re already on the guest list as not going. Use your invitation link to change your reply.",
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
      data: { userId: input.viewer.id, rsvpStatus: "ATTENDING", respondedAt: new Date() },
    });
  } else {
    await db.guest.create({
      data: {
        eventId: event.id,
        userId: input.viewer.id,
        name: input.viewer.name.trim() || email,
        email,
        rsvpStatus: "ATTENDING",
        respondedAt: new Date(),
      },
    });
  }
  return { ok: true };
}

/** True when this account is registered as attending. */
export async function isRegistered(eventId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const row = await db.guest.findFirst({
    where: { eventId, userId, rsvpStatus: "ATTENDING" },
    select: { id: true },
  });
  return row !== null;
}

/** Event ids from `eventIds` this account is registered for. */
export async function registeredEventIds(
  eventIds: string[],
  userId: string | null,
): Promise<Set<string>> {
  if (!userId || eventIds.length === 0) return new Set();
  const rows = await db.guest.findMany({
    where: { userId, rsvpStatus: "ATTENDING", eventId: { in: eventIds } },
    select: { eventId: true },
  });
  return new Set(rows.map((r) => r.eventId));
}
