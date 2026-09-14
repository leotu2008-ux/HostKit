import { db } from "@/lib/db";
import { newRsvpToken } from "@/lib/tokens";
import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Selling a ticket and tearing it at the door.
 *
 * Money is deliberately not wired to a payment provider yet. An order is
 * placed as PENDING and the organiser marks it paid once the cash, transfer
 * or card has actually arrived — which is how student orgs already collect,
 * and means the list and the door work before any of that is built. When a
 * provider does arrive it sets the same fields, and nothing else moves.
 */

export type TierWithSales = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  salesOpenAt: Date | null;
  salesCloseAt: Date | null;
  sold: number;
  left: number;
};

/** Tiers a buyer can actually take right now: on sale and not sold out. */
export function onSale(tier: TierWithSales, now = new Date()): boolean {
  if (tier.left <= 0) return false;
  if (tier.salesOpenAt && tier.salesOpenAt > now) return false;
  if (tier.salesCloseAt && tier.salesCloseAt < now) return false;
  return true;
}

/** A ticket counts against its tier unless it has been voided. */
const LIVE_TICKET = { voidedAt: null } as const;

export async function tiersForEvent(eventId: string): Promise<TierWithSales[]> {
  const tiers = await db.ticketTier.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { tickets: { where: LIVE_TICKET } } } },
  });
  return tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    priceCents: tier.priceCents,
    quantity: tier.quantity,
    salesOpenAt: tier.salesOpenAt,
    salesCloseAt: tier.salesCloseAt,
    sold: tier._count.tickets,
    left: Math.max(0, tier.quantity - tier._count.tickets),
  }));
}

export type OrderRequest = {
  eventId: string;
  email: string;
  name: string;
  /** How many of each tier, keyed by tier id. Zero and missing are the same. */
  items: Record<string, number>;
  note?: string | null;
};

export type OrderResult =
  | { ok: true; orderId: string; token: string; totalCents: number; count: number }
  | { ok: false; reason: "empty" | "not-on-sale" | "sold-out" | "too-many"; message: string };

/** Nobody needs fifty tickets in one go, and a typo shouldn't empty an event. */
export const MAX_PER_ORDER = 10;

/**
 * Takes an order, or explains why not. The capacity check and the write
 * share one transaction with the event row locked, so two people taking the
 * last two tickets at once can't both win — the same guard registration
 * uses for the last seat.
 */
export async function placeOrder(input: OrderRequest): Promise<OrderResult> {
  const wanted = Object.entries(input.items).filter(([, n]) => n > 0);
  const count = wanted.reduce((sum, [, n]) => sum + n, 0);
  if (count === 0) return { ok: false, reason: "empty", message: "Choose at least one ticket." };
  if (count > MAX_PER_ORDER) {
    return { ok: false, reason: "too-many", message: `That's more than ${MAX_PER_ORDER} tickets in one order.` };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${input.eventId} FOR UPDATE`;

    const tiers = await tx.ticketTier.findMany({
      where: { eventId: input.eventId, id: { in: wanted.map(([id]) => id) } },
      include: { _count: { select: { tickets: { where: LIVE_TICKET } } } },
    });
    const byId = new Map(tiers.map((t) => [t.id, t]));
    const now = new Date();

    let totalCents = 0;
    for (const [tierId, n] of wanted) {
      const tier = byId.get(tierId);
      if (!tier) return { ok: false, reason: "not-on-sale", message: "That ticket isn't available." } as const;
      const left = Math.max(0, tier.quantity - tier._count.tickets);
      const shaped = { ...tier, sold: tier._count.tickets, left };
      if (!onSale(shaped, now)) {
        return { ok: false, reason: "not-on-sale", message: `${tier.name} isn't on sale.` } as const;
      }
      if (n > left) {
        return {
          ok: false,
          reason: "sold-out",
          message: left === 0 ? `${tier.name} is sold out.` : `Only ${left} left of ${tier.name}.`,
        } as const;
      }
      totalCents += tier.priceCents * n;
    }

    const order = await tx.order.create({
      data: {
        eventId: input.eventId,
        email,
        name,
        note: input.note?.trim() || null,
        totalCents,
        token: newRsvpToken(),
        // Free orders are settled the moment they're placed; there is
        // nothing to collect and the door should let them straight in.
        status: totalCents === 0 ? "PAID" : "PENDING",
        paidAt: totalCents === 0 ? new Date() : null,
        paidVia: totalCents === 0 ? "free" : null,
      },
    });

    await tx.ticket.createMany({
      data: wanted.flatMap(([tierId, n]) =>
        Array.from({ length: n }, () => ({
          orderId: order.id,
          ticketTierId: tierId,
          holderName: null,
          token: newRsvpToken(),
        })),
      ),
    });

    return { ok: true, orderId: order.id, token: order.token, totalCents, count } as const;
  });
}

/** The organiser confirming the money landed. */
export async function markOrderPaid(orderId: string, via: string): Promise<void> {
  await db.order.update({
    where: { id: orderId },
    data: { status: "PAID", paidAt: new Date(), paidVia: via.trim() || "other" },
  });
}

/**
 * Refunding voids the tickets rather than deleting them, so a torn ticket
 * that turns up at the door can still be explained.
 */
export async function refundOrder(orderId: string): Promise<void> {
  await db.$transaction([
    db.ticket.updateMany({ where: { orderId, voidedAt: null }, data: { voidedAt: new Date() } }),
    db.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } }),
  ]);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await db.$transaction([
    db.ticket.updateMany({ where: { orderId, voidedAt: null }, data: { voidedAt: new Date() } }),
    db.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } }),
  ]);
}

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

export type ScannedTicket = {
  eventId: string;
  status: OrderStatus;
  voidedAt: Date | null;
  checkedInAt: Date | null;
};

export type Verdict =
  | { kind: "ok" }
  /** Already through. The door still needs to see when, to spot a passback. */
  | { kind: "already"; at: Date }
  /** Real ticket, money never arrived. The organiser decides. */
  | { kind: "unpaid" }
  | { kind: "void" }
  | { kind: "wrong-event" }
  | { kind: "not-found" };

/**
 * What the door should say about a ticket. Pure, because this is the one
 * piece of logic that has to be right at midnight with a queue building.
 */
export function judgeTicket(ticket: ScannedTicket | null, eventId: string): Verdict {
  if (!ticket) return { kind: "not-found" };
  if (ticket.eventId !== eventId) return { kind: "wrong-event" };
  if (ticket.voidedAt || ticket.status === "REFUNDED" || ticket.status === "CANCELLED") {
    return { kind: "void" };
  }
  if (ticket.checkedInAt) return { kind: "already", at: ticket.checkedInAt };
  if (ticket.status !== "PAID") return { kind: "unpaid" };
  return { kind: "ok" };
}

export type ScanOutcome = {
  verdict: Verdict;
  holder: string | null;
  tierName: string | null;
  orderId: string | null;
};

/** Looks a scanned token up, judges it, and admits it when it's good. */
export async function scanTicket(eventId: string, token: string): Promise<ScanOutcome> {
  const ticket = await db.ticket.findUnique({
    where: { token: token.trim() },
    include: { order: { select: { id: true, eventId: true, status: true, name: true } }, ticketTier: true },
  });

  const verdict = judgeTicket(
    ticket && {
      eventId: ticket.order.eventId,
      status: ticket.order.status,
      voidedAt: ticket.voidedAt,
      checkedInAt: ticket.checkedInAt,
    },
    eventId,
  );

  if (ticket && verdict.kind === "ok") {
    await db.ticket.update({ where: { id: ticket.id }, data: { checkedInAt: new Date() } });
  }

  return {
    verdict,
    holder: ticket ? (ticket.holderName ?? ticket.order.name) : null,
    tierName: ticket?.ticketTier.name ?? null,
    orderId: ticket?.order.id ?? null,
  };
}

/** Lets the organiser wave through someone whose money hasn't landed. */
export async function admitAnyway(ticketToken: string): Promise<void> {
  await db.ticket.update({ where: { token: ticketToken.trim() }, data: { checkedInAt: new Date() } });
}

// ---------------------------------------------------------------------------
// The one dashboard number set
// ---------------------------------------------------------------------------

export type EventTakings = {
  sold: number;
  checkedIn: number;
  paidCents: number;
  owedCents: number;
};

export async function takingsFor(eventId: string): Promise<EventTakings> {
  const orders = await db.order.findMany({
    where: { eventId, status: { in: ["PENDING", "PAID"] } },
    select: { status: true, totalCents: true, _count: { select: { tickets: { where: LIVE_TICKET } } } },
  });
  const checkedIn = await db.ticket.count({
    where: { order: { eventId }, voidedAt: null, checkedInAt: { not: null } },
  });
  return {
    sold: orders.reduce((n, o) => n + o._count.tickets, 0),
    checkedIn,
    paidCents: orders.filter((o) => o.status === "PAID").reduce((n, o) => n + o.totalCents, 0),
    owedCents: orders.filter((o) => o.status === "PENDING").reduce((n, o) => n + o.totalCents, 0),
  };
}
