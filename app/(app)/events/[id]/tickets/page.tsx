import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { tiersForEvent, takingsFor } from "@/lib/tickets";
import { markPaidAction, refundOrderAction, removeTierAction } from "@/lib/actions/tickets";
import { AddTierForm } from "@/components/ticket-forms";
import { Badge, Button, EmptyState } from "@/components/ui";

export const metadata = { title: "Tickets" };

const STATUS_TONE = {
  PAID: "forest",
  PENDING: "amber",
  REFUNDED: "neutral",
  CANCELLED: "neutral",
} as const;

export default async function TicketsPage({ params }: PageProps<"/events/[id]/tickets">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const [tiers, takings, orders] = await Promise.all([
    tiersForEvent(event.id),
    takingsFor(event.id),
    db.order.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { tickets: { where: { voidedAt: null } } } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Tickets out", value: String(takings.sold) },
            { label: "Through the door", value: String(takings.checkedIn) },
            { label: "Money in", value: formatCents(takings.paidCents) },
            { label: "Still owed", value: formatCents(takings.owedCents) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-card border border-line bg-surface p-4">
              <p className="text-[13px] text-ink-mute">{stat.label}</p>
              <p className="tabular mt-1 text-[22px] font-semibold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">On sale</h2>
        <p className="mt-1 mb-4 text-[14px] text-ink-soft">
          Every ticket gets its own code to scan at the door, free ones included.
        </p>

        {tiers.length > 0 ? (
          <ul className="mb-5 space-y-2">
            {tiers.map((tier) => (
              <li
                key={tier.id}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{tier.name}</p>
                  <p className="tabular text-[13px] text-ink-soft">
                    {tier.priceCents === 0 ? "Free" : formatCents(tier.priceCents)} · {tier.sold} of{" "}
                    {tier.quantity} gone
                  </p>
                </div>
                {tier.sold === 0 ? (
                  <form action={removeTierAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="tierId" value={tier.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : (
                  <Badge tone={tier.left === 0 ? "amber" : "neutral"}>
                    {tier.left === 0 ? "Sold out" : `${tier.left} left`}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-card border border-line bg-surface p-4">
          <AddTierForm eventId={event.id} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Orders</h2>
        <p className="mt-1 mb-4 text-[14px] text-ink-soft">
          Money is settled with the buyer directly for now. Mark an order paid once it lands.
        </p>

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            body="Share the event link and they'll show up here as people take tickets."
          />
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.id} className="rounded-card border border-line bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{order.name}</p>
                    <p className="truncate text-[13px] text-ink-soft">{order.email}</p>
                    <p className="tabular mt-0.5 text-[13px] text-ink-mute">
                      {order._count.tickets} {order._count.tickets === 1 ? "ticket" : "tickets"} ·{" "}
                      {formatCents(order.totalCents)}
                      {order.paidVia ? ` · ${order.paidVia}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[order.status]}>{order.status.toLowerCase()}</Badge>
                    {order.status === "PENDING" ? (
                      <form action={markPaidAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <select
                          name="via"
                          aria-label="How they paid"
                          className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
                        >
                          <option value="venmo">Venmo</option>
                          <option value="cash">Cash</option>
                          <option value="other">Other</option>
                        </select>
                        <Button type="submit" size="sm">
                          Mark paid
                        </Button>
                      </form>
                    ) : null}
                    {order.status === "PAID" || order.status === "PENDING" ? (
                      <form action={refundOrderAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {order.status === "PAID" ? "Refund" : "Cancel"}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
