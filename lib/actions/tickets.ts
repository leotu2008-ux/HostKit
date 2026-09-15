"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { parseCents } from "@/lib/money";
import {
  admitAnyway,
  cancelOrder,
  markOrderPaid,
  placeOrder,
  refundOrder,
  scanTicket,
  tiersForEvent,
  type ScanOutcome,
} from "@/lib/tickets";

export type TierFormState = { error?: string } | undefined;
export type BuyFormState = { error?: string } | undefined;
export type DoorState = { outcome?: ScanOutcome; error?: string } | undefined;

const tierSchema = z.object({
  name: z.string().trim().min(1, "Name this ticket.").max(60),
  quantity: z.coerce.number().int().min(1, "At least one.").max(100_000),
});

/** The organiser putting something on sale. */
export async function addTierAction(_prev: TierFormState, formData: FormData): Promise<TierFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  const parsed = tierSchema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Free is allowed and useful: a free tier still prints a scannable ticket.
  const priceCents = parseCents(String(formData.get("price") ?? "")) ?? 0;

  const count = await db.ticketTier.count({ where: { eventId: event.id } });
  await db.ticketTier.create({
    data: {
      eventId: event.id,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      priceCents,
      sortOrder: count,
    },
  });
  refresh();
}

export async function removeTierAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const tierId = String(formData.get("tierId") ?? "");
  await requireEvent(eventId);
  // Only while nothing has been sold — otherwise a refund is the right path.
  const sold = await db.ticket.count({ where: { ticketTierId: tierId, voidedAt: null } });
  if (sold === 0) await db.ticketTier.deleteMany({ where: { id: tierId, eventId } });
  refresh();
}

const buySchema = z.object({
  name: z.string().trim().min(1, "Tell us who these are for.").max(80),
  email: z.string().trim().toLowerCase().email("Enter an email we can send the tickets to."),
});

/**
 * The buyer. No account: the tickets arrive at the email, and the order
 * token is the private link back to them.
 */
export async function buyTicketsAction(_prev: BuyFormState, formData: FormData): Promise<BuyFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const parsed = buySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const tiers = await tiersForEvent(eventId);
  const items: Record<string, number> = {};
  for (const tier of tiers) {
    const n = Number(formData.get(`qty_${tier.id}`) ?? 0);
    if (Number.isFinite(n) && n > 0) items[tier.id] = Math.floor(n);
  }

  const result = await placeOrder({
    eventId,
    email: parsed.data.email,
    name: parsed.data.name,
    items,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) return { error: result.message };

  redirect(`/t/${result.token}`);
}

export async function markPaidAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await requireEvent(eventId);
  const order = await db.order.findFirst({ where: { id: orderId, eventId }, select: { id: true } });
  if (order) await markOrderPaid(order.id, String(formData.get("via") ?? "other"));
  refresh();
}

export async function refundOrderAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await requireEvent(eventId);
  const order = await db.order.findFirst({ where: { id: orderId, eventId }, select: { id: true, status: true } });
  if (!order) return;
  if (order.status === "PAID") await refundOrder(order.id);
  else await cancelOrder(order.id);
  refresh();
}

/** The door. Takes whatever the scanner or the typed box produced. */
export async function scanAction(_prev: DoorState, formData: FormData): Promise<DoorState> {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEvent(eventId);

  const raw = String(formData.get("token") ?? "").trim();
  if (!raw) return { error: "Scan a ticket or type its code." };
  // A scanner may hand back the whole URL; the last path segment is the token.
  const token = raw.includes("/") ? (raw.split("/").filter(Boolean).pop() ?? raw) : raw;

  const outcome = await scanTicket(eventId, token);
  return { outcome };
}

export async function admitAnywayAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const token = String(formData.get("token") ?? "");
  await requireEvent(eventId);
  const ticket = await db.ticket.findFirst({
    where: { token, order: { eventId } },
    select: { token: true },
  });
  if (ticket) await admitAnyway(ticket.token);
  refresh();
}
