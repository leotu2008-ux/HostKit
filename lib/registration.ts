import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";
import { notify } from "@/lib/notify";
import { newRsvpToken } from "@/lib/tokens";
import { linkGuestsToContacts } from "@/lib/guest-book";
import { hasFinished } from "@/lib/outcomes";
import { attendingHeads } from "@/lib/waitlist";
import type { RsvpStatus } from "@/generated/prisma/enums";

/** Where an account stands with an event. Mirrors `RegistrationState` on iOS. */
export type RegistrationState = "none" | "going" | "pending" | "waitlisted";

export type RegistrationResult =
  | { ok: true; state: "going" | "pending" | "waitlisted"; changed: boolean }
  | {
      ok: false;
      code: "not_listed" | "declined" | "sign_in" | "closed";
      error: string;
    };

const NOT_LISTED: RegistrationResult = {
  ok: false,
  code: "not_listed",
  error: "That event isn’t listed anymore.",
};

export type Registrant = { id: string; name: string; email: string };

/**
 * The pure decision behind a registration, so it can be unit-tested without
 * a database. `unchanged` means the existing row already answers it.
 */
export function decideRegistration(input: {
  existing: RsvpStatus | null;
  isHost: boolean;
  requiresApproval: boolean;
  /** Heads already going, plus-ones included. */
  attending: number;
  /** Heads the registrant would bring: themselves and their plus-ones. */
  party: number;
  capacity: number;
}): "going" | "pending" | "waitlisted" | "declined" | "unchanged" {
  switch (input.existing) {
    case "ATTENDING":
    case "PENDING":
    case "WAITLISTED":
      return "unchanged";
    case "DECLINED":
      return "declined";
    default:
      break;
  }
  if (input.requiresApproval && !input.isHost) return "pending";
  if (input.attending + input.party > input.capacity) return "waitlisted";
  return "going";
}

export function stateOf(status: RsvpStatus | null | undefined): RegistrationState {
  switch (status) {
    case "ATTENDING":
      return "going";
    case "PENDING":
      return "pending";
    case "WAITLISTED":
      return "waitlisted";
    default:
      return "none";
  }
}

/**
 * Registration for a published night, shared by the web Register button and
 * the iOS API.
 *
 * Registering needs an account: the guest row carries the account's id and
 * email, which is what blasts go to. Names the host added by hand stay
 * account-less rows on the same list.
 *
 * An existing row is never renamed, a guest who declined can only change
 * that from their own RSVP link, an approval-required event queues the
 * request for the host, and a full event puts you on the waitlist. The
 * count-and-write runs with the event row locked so two people can't both
 * take the last seat.
 */
export async function registerGuest(input: {
  eventId: string;
  viewer: Registrant | null;
}): Promise<RegistrationResult> {
  if (!input.viewer) {
    return { ok: false, code: "sign_in", error: "Sign in to register." };
  }
  const viewer = input.viewer;

  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      title: true,
      published: true,
      visibility: true,
      ownerId: true,
      guestCount: true,
      requiresApproval: true,
      date: true,
      endDate: true,
      durationHours: true,
      status: true,
      club: { select: { id: true, members: { select: { userId: true } } } },
    },
  });
  if (!event) return NOT_LISTED;

  // The owner and the admins of the club it's posted as run the night: they
  // see it while private and never queue behind approval or the waitlist.
  const isHost =
    viewer.id === event.ownerId ||
    (event.club?.members.some((m) => m.userId === viewer.id) ?? false);
  if (!isPublicPageVisible(event) && !isHost) return NOT_LISTED;
  // An old link stays up after the night; registering then would add a
  // "going" guest (or a request for the host) to a night that's over.
  if (event.status === "COMPLETED" || hasFinished(event)) {
    return { ok: false, code: "closed", error: "This night has already happened." };
  }

  const email = viewer.email.trim().toLowerCase();

  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${event.id} FOR UPDATE`;

    // Match by account first, then by email so a name the host typed in
    // beforehand becomes that person's registration rather than a duplicate.
    const existing =
      (await tx.guest.findFirst({ where: { eventId: event.id, userId: viewer.id } })) ??
      (await tx.guest.findFirst({ where: { eventId: event.id, email } }));

    // Capacity is people in the room: the yeses so far and the people they
    // bring, and a row the host already filled in keeps its plus-ones.
    const attending = await attendingHeads(tx, event.id);
    const decision = decideRegistration({
      existing: existing?.rsvpStatus ?? null,
      isHost,
      requiresApproval: event.requiresApproval,
      attending,
      party: 1 + Math.max(0, existing?.plusOnes ?? 0),
      capacity: event.guestCount,
    });

    if (decision === "declined") {
      return {
        ok: false,
        code: "declined",
        error:
          "You’re already on the guest list as not going. Use your invitation link to change your reply.",
      } as const;
    }
    if (decision === "unchanged" && existing) {
      if (!existing.userId) {
        await tx.guest.update({ where: { id: existing.id }, data: { userId: viewer.id } });
      }
      return { ok: true, state: stateOf(existing.rsvpStatus) as "going" | "pending" | "waitlisted", changed: false } as const;
    }

    const rsvpStatus: RsvpStatus =
      decision === "pending" ? "PENDING" : decision === "waitlisted" ? "WAITLISTED" : "ATTENDING";
    if (existing) {
      await tx.guest.update({
        where: { id: existing.id },
        data: { userId: viewer.id, rsvpStatus, respondedAt: new Date() },
      });
    } else {
      await tx.guest.create({
        data: {
          eventId: event.id,
          userId: viewer.id,
          rsvpToken: newRsvpToken(),
          name: viewer.name.trim() || email,
          email,
          rsvpStatus,
          respondedAt: new Date(),
        },
      });
    }
    return { ok: true, state: decision as "going" | "pending" | "waitlisted", changed: true } as const;
  });

  if (result.ok && result.changed) {
    try {
      await linkGuestsToContacts(event.id);
    } catch (error) {
      console.error("linkGuestsToContacts failed", error);
    }
  }

  // A new request is the host's to answer — tell them and the club's admins.
  if (result.ok && result.state === "pending" && result.changed) {
    const hosts = [event.ownerId, ...(event.club?.members.map((m) => m.userId) ?? [])].filter(
      (id): id is string => Boolean(id),
    );
    await notify(hosts, {
      kind: "registration_request",
      title: `${viewer.name.trim() || email} asked to join ${event.title}`,
      body: "Approve or decline from the event's Overview.",
      eventId: event.id,
    });
  }
  return result;
}

/** Where this account stands with one event. */
export async function registrationState(
  eventId: string,
  userId: string | null,
): Promise<RegistrationState> {
  if (!userId) return "none";
  const row = await db.guest.findFirst({
    where: { eventId, userId },
    select: { rsvpStatus: true },
  });
  return stateOf(row?.rsvpStatus);
}

/** Registration states for many events at once (feeds). */
export async function registrationStates(
  eventIds: string[],
  userId: string | null,
): Promise<Map<string, RegistrationState>> {
  const out = new Map<string, RegistrationState>();
  if (!userId || eventIds.length === 0) return out;
  const rows = await db.guest.findMany({
    where: { userId, eventId: { in: eventIds } },
    select: { eventId: true, rsvpStatus: true },
  });
  for (const row of rows) {
    const state = stateOf(row.rsvpStatus);
    if (state !== "none") out.set(row.eventId, state);
  }
  return out;
}

/** True when this account is registered as attending. */
export async function isRegistered(eventId: string, userId: string | null): Promise<boolean> {
  return (await registrationState(eventId, userId)) === "going";
}

/** Event ids from `eventIds` this account is registered (attending) for. */
export async function registeredEventIds(
  eventIds: string[],
  userId: string | null,
): Promise<Set<string>> {
  const states = await registrationStates(eventIds, userId);
  return new Set([...states].filter(([, state]) => state === "going").map(([id]) => id));
}
