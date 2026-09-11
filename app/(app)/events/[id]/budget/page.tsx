import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { summarizeBudget } from "@/lib/budget";
import { formatCents } from "@/lib/money";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, Card, SectionHeading } from "@/components/ui";

export default async function BudgetPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const categories = await db.budgetCategory.findMany({
    where: { eventId: event.id },
    include: {
      items: { include: { listing: { select: { name: true } } } },
    },
    orderBy: { allocatedCents: "desc" },
  });

  const budget = summarizeBudget(categories);

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-soft">Committed so far</p>
            <p className="font-display tabular mt-1 text-3xl text-ink">
              {formatCents(budget.committedCents)}
              <span className="text-xl text-ink-mute">
                {" "}
                / {formatCents(budget.allocatedCents)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-soft">
              {budget.overBudget ? "Over budget by" : "Still unspent"}
            </p>
            <p className="font-display tabular mt-1 text-2xl text-ink">
              {formatCents(Math.abs(budget.remainingCents))}
            </p>
          </div>
        </div>
        <ProgressBar
          className="mt-5"
          percent={budget.percentCommitted}
          tone={budget.overBudget ? "danger" : "clay"}
        />
        <p className="mt-3 text-sm text-ink-mute">
          {formatCents(budget.paidCents)} paid ·{" "}
          {formatCents(budget.outstandingCents)} still owed
        </p>
      </Card>

      {budget.overspentCategories.length > 0 ? (
        <Card className="border-amber/30 bg-amber-wash p-4">
          <p className="text-sm text-amber">
            <span className="font-semibold">Over their allocation:</span>{" "}
            {budget.overspentCategories.map((r) => r.name).join(", ")}. The
            allocation is a starting split, not a rule — move money between
            categories as you learn what things actually cost.
          </p>
        </Card>
      ) : null}

      <section>
        <SectionHeading
          title="By category"
          hint="Allocations come from your event type and total budget. Bookings land here automatically."
        />
        <div className="space-y-3">
          {budget.rows.map((row) => (
            <Card key={row.category} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-ink">{row.name}</h3>
                  {row.overCents > 0 ? (
                    <Badge tone="danger">
                      {formatCents(row.overCents)} over
                    </Badge>
                  ) : null}
                </div>
                <p className="tabular text-sm text-ink-soft">
                  {formatCents(row.committedCents)}
                  <span className="text-ink-mute">
                    {" "}
                    / {formatCents(row.allocatedCents)}
                  </span>
                </p>
              </div>

              <ProgressBar
                className="mt-3"
                percent={row.percentOfAllocation}
                tone={row.overCents > 0 ? "danger" : "clay"}
              />

              {row.itemCount === 0 ? (
                <p className="mt-3 text-sm text-ink-mute">
                  Nothing booked yet — the full {formatCents(row.allocatedCents)}{" "}
                  is still available.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {categories
                    .find((c) => c.category === row.category)!
                    .items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline justify-between gap-3 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">
                          {item.label}
                        </span>
                        <span className="tabular shrink-0 text-sm text-ink-soft">
                          {formatCents(item.actualCents ?? item.estimatedCents)}
                          {item.paidCents > 0 ? (
                            <span className="text-forest">
                              {" "}
                              · {formatCents(item.paidCents)} paid
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
