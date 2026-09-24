import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { hasStarted } from "@/lib/outcomes";
import type { RsvpStatus } from "@/generated/prisma/enums";

async function eventTitle(eventId: string): Promise<string> {
  const row = await db.event.findUnique({ where: { id: eventId }, select: { title: true } });
  return row?.title ?? "the event";
}

/**
 * Approval requests and the waitlist. Room frees whenever an ATTENDING
 * guest stops attending (host change, their own decline, removal) or brings
 * fewer people; every path that does that calls `promoteWaitlist`, which lets
 * in the people who have waited longest until the event is full again, up to
 * the start time.
 */

/**
 * True when moving a guest from `from` to `to` can let someone waiting in:
 * a going guest stops attending or brings fewer plus-ones, or a waiting
 * party leaves the line or gets smaller and so stops holding a seat for
 * whoever fits behind them.
 */
export function releasesSeat(
  from: RsvpStatus,
  to: RsvpStatus | null,
  plusOnes?: { from: number; to: number },
): boolean {
  if (from !== "ATTENDING" && from !== "WAITLISTED") return false;
  if (to !== from) return true;
  return plusOnes !== undefined && plusOnes.to < plusOnes.from;
}

/**
 * Pure: which of the waiting guests (oldest first) fit into `room` seats.
 * A guest takes a seat for themselves and one per plus-one. A party that
 * doesn't fit the seats left is passed over for now, so a big party never
 * keeps smaller ones behind it out of seats that would otherwise sit empty.
 */
export function promotionPlan<T extends { createdAt: Date; plusOnes?: number }>(waiting: T[], room: number): T[] {
  const plan: T[] = [];
  let left = room;
  for (const guest of [...waiting].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const heads = 1 + Math.max(0, guest.plusOnes ?? 0);
    if (heads > left) continue;
    plan.push(guest);
    left -= heads;
  }
  return plan;
}

/**
 * Heads already going: every ATTENDING guest plus the people they bring, so
 * capacity means people in the room. `except` leaves one guest out (the one
 * whose own reply is being weighed).
 */
export async function attendingHeads(
  client: Pick<typeof db, "guest">,
  eventId: string,
  except?: string,
): Promise<number> {
  const going = await client.guest.aggregate({
    where: { eventId, rsvpStatus: "ATTENDING", ...(except ? { id: { not: except } } : {}) },
    _count: true,
    _sum: { plusOnes: true },
  });
  return going._count + (going._sum.plusOnes ?? 0);
}

/**
 * Whether a party of `heads` gets a seat now: it fits the seats left and
 * nobody already waiting fits them first (the line was there first).
 * `except` leaves the party's own row out of both counts.
 */
export async function seatFree(
  client: Pick<typeof db, "guest">,
  eventId: string,
  capacity: number,
  heads: number,
  except?: string,
): Promise<boolean> {
  const room = capacity - (await attendingHeads(client, eventId, except));
  if (heads > room) return false;
  const waitingThatFits = await client.guest.count({
    where: {
      eventId,
      rsvpStatus: "WAITLISTED",
      plusOnes: { lte: room - 1 },
      ...(except ? { id: { not: except } } : {}),
    },
  });
  return waitingThatFits === 0;
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
      select: { guestCount: true, date: true, status: true, schoolDomain: true },
    });
    if (!event) return [];
    // Once the night has started, whoever's next is at home: a seat freed by
    // a no-show marked "Not going" shouldn't tell them they're in. The host
    // can still move someone in by hand from the Guests tab.
    if (event.status === "COMPLETED" || hasStarted(event)) return [];
    const room = event.guestCount - (await attendingHeads(tx, eventId));
    if (room <= 0) return [];
    const waiting = promotionPlan(
      await tx.guest.findMany({
        where: { eventId, rsvpStatus: "WAITLISTED" },
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, name: true, email: true, plusOnes: true, createdAt: true },
      }),
      room,
    );
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
 * The host answers a request. Approving puts them in if there's room for
 * them and their plus-ones and on the waitlist otherwise; declining ends it.
 * Returns the new state, or null when the guest wasn't waiting for a decision.
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
      select: { id: true, userId: true, name: true, email: true, rsvpStatus: true, plusOnes: true },
    });
    if (!guest || (guest.rsvpStatus !== "PENDING" && guest.rsvpStatus !== "WAITLISTED")) return null;

    let state: Decision;
    if (!approve) {
      state = "declined";
    } else {
      const event = await tx.event.findUnique({ where: { id: eventId }, select: { guestCount: true } });
      const heads = 1 + Math.max(0, guest.plusOnes);
      state = event && (await seatFree(tx, eventId, event.guestCount, heads, guest.id)) ? "going" : "waitlisted";
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
