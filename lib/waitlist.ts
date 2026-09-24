import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import type { RsvpStatus } from "@/generated/prisma/enums";

async function eventTitle(eventId: string): Promise<string> {
  const row = await db.event.findUnique({ where: { id: eventId }, select: { title: true } });
  return row?.title ?? "the event";
}

/**
 * Approval requests and the waitlist. A seat frees whenever an ATTENDING
 * guest stops attending (host change, their own decline, removal); every
 * path that does that calls `promoteWaitlist`, which lets in the people who
 * have waited longest until the event is full again, up to the start time.
 */

/** True when moving a guest from `from` to `to` frees a seat. */
export function releasesSeat(from: RsvpStatus, to: RsvpStatus | null): boolean {
  return from === "ATTENDING" && to !== "ATTENDING";
}

/** Pure: which of the waiting guests (oldest first) fit into `room` seats. */
export function promotionPlan<T extends { createdAt: Date }>(waiting: T[], room: number): T[] {
  if (room <= 0) return [];
  return [...waiting].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, room);
}

export type PromotedGuest = { id: string; userId: string | null; name: string; email: string | null };

/** Fills freed seats from the waitlist and tells the people who got in. */
export async function promoteWaitlist(eventId: string): Promise<PromotedGuest[]> {
  const promoted = await promoteWaitlistRows(eventId);
  const userIds = promoted.map((g) => g.userId).filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    await notify(userIds, {
      kind: "waitlist_promoted",
      title: `A spot opened at ${await eventTitle(eventId)} — you're in`,
      body: "You were next on the waitlist. See you there.",
      eventId,
    });
  }
  return promoted;
}

async function promoteWaitlistRows(eventId: string): Promise<PromotedGuest[]> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { guestCount: true, date: true, status: true },
    });
    if (!event) return [];
    // Once the night has started, whoever's next is at home: a seat freed by
    // a no-show marked "Not going" shouldn't tell them they're in. The host
    // can still move someone in by hand from the Guests tab.
    if (event.status === "COMPLETED" || (event.date && event.date.getTime() <= Date.now())) return [];
    const attending = await tx.guest.count({ where: { eventId, rsvpStatus: "ATTENDING" } });
    const room = event.guestCount - attending;
    if (room <= 0) return [];
    const waiting = await tx.guest.findMany({
      where: { eventId, rsvpStatus: "WAITLISTED" },
      orderBy: { createdAt: "asc" },
      take: room,
      select: { id: true, userId: true, name: true, email: true, createdAt: true },
    });
    if (waiting.length === 0) return [];
    await tx.guest.updateMany({
      where: { id: { in: waiting.map((g) => g.id) } },
      data: { rsvpStatus: "ATTENDING", respondedAt: new Date() },
    });
    return waiting.map((g) => ({ id: g.id, userId: g.userId, name: g.name, email: g.email }));
  });
}

export type Decision = "going" | "waitlisted" | "declined";

/**
 * The host answers a request. Approving puts them in if there's room and on
 * the waitlist otherwise; declining ends it. Returns the new state, or null
 * when the guest wasn't waiting for a decision.
 */
export async function decideRequest(
  eventId: string,
  guestId: string,
  approve: boolean,
): Promise<{ state: Decision; guest: PromotedGuest } | null> {
  const decided = await decideRequestRow(eventId, guestId, approve);
  if (decided?.guest.userId && decided.state !== "declined") {
    const title = await eventTitle(eventId);
    await notify([decided.guest.userId], {
      kind: "registration_approved",
      title: decided.state === "going" ? `You're in: ${title}` : `Approved for ${title} — you're on the waitlist`,
      body:
        decided.state === "going"
          ? "The host confirmed your spot. See you there."
          : "The host said yes, but it's full right now. You're in automatically when a spot opens.",
      eventId,
    });
  }
  return decided;
}

async function decideRequestRow(
  eventId: string,
  guestId: string,
  approve: boolean,
): Promise<{ state: Decision; guest: PromotedGuest } | null> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const guest = await tx.guest.findFirst({
      where: { id: guestId, eventId },
      select: { id: true, userId: true, name: true, email: true, rsvpStatus: true },
    });
    if (!guest || (guest.rsvpStatus !== "PENDING" && guest.rsvpStatus !== "WAITLISTED")) return null;

    let state: Decision;
    if (!approve) {
      state = "declined";
    } else {
      const event = await tx.event.findUnique({ where: { id: eventId }, select: { guestCount: true } });
      const attending = await tx.guest.count({ where: { eventId, rsvpStatus: "ATTENDING" } });
      state = event && attending < event.guestCount ? "going" : "waitlisted";
    }
    await tx.guest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: state === "going" ? "ATTENDING" : state === "waitlisted" ? "WAITLISTED" : "DECLINED",
        respondedAt: new Date(),
      },
    });
    return { state, guest: { id: guest.id, userId: guest.userId, name: guest.name, email: guest.email } };
  });
}

/** The signed-in account's place in line, or null. */
export async function waitlistPositionFor(eventId: string, userId: string | null): Promise<number | null> {
  if (!userId) return null;
  const row = await db.guest.findFirst({
    where: { eventId, userId, rsvpStatus: "WAITLISTED" },
    select: { id: true },
  });
  return row ? waitlistPosition(eventId, row.id) : null;
}

/** 1-based place in line, or null when not waitlisted. */
export async function waitlistPosition(eventId: string, guestId: string): Promise<number | null> {
  const me = await db.guest.findFirst({
    where: { id: guestId, eventId, rsvpStatus: "WAITLISTED" },
    select: { createdAt: true },
  });
  if (!me) return null;
  const ahead = await db.guest.count({
    where: { eventId, rsvpStatus: "WAITLISTED", createdAt: { lt: me.createdAt } },
  });
  return ahead + 1;
}
