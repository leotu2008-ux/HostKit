import Link from "next/link";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { summarizeBudget } from "@/lib/budget";
import { computeCoverage, outstandingRequired } from "@/lib/coverage";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { templateFor } from "@/lib/templates";
import { formatCents } from "@/lib/money";
import { ProgressBar } from "@/components/progress-bar";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeading,
} from "@/components/ui";

function formatDue(date: Date | null) {
  if (!date) return "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function EventOverviewPage({
  params,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const [categories, tasks, taskCounts, inquiries] = await Promise.all([
    db.budgetCategory.findMany({
      where: { eventId: event.id },
      include: { items: true },
      orderBy: { allocatedCents: "desc" },
    }),
    db.task.findMany({
      where: { eventId: event.id, status: "TODO" },
      orderBy: [{ dueDate: "asc" }, { offsetDays: "desc" }],
      take: 4,
    }),
    db.task.groupBy({
      by: ["status"],
      where: { eventId: event.id },
      _count: true,
    }),
    db.inquiry.findMany({
      where: { eventId: event.id },
      include: { listing: { select: { name: true, category: true } } },
    }),
  ]);

  const budget = summarizeBudget(categories);
  const template = templateFor(event.type);
  const coverage = computeCoverage(
    template.required,
    categories.map((c) => c.category),
    inquiries,
  );
  const outstanding = outstandingRequired(coverage);

  const done = taskCounts.find((c) => c.status === "DONE")?._count ?? 0;
  const total = taskCounts.reduce((sum, c) => sum + c._count, 0);
  const days = daysUntil(event.date);

  return (
    <div className="space-y-8">
      {/* Three numbers that say where the event stands. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Countdown</p>
          <p className="font-display mt-1 text-2xl text-ink">
            {describeCountdown(days)}
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {event.date
              ? event.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Add a date to anchor the timeline"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Budget committed</p>
          <p className="font-display tabular mt-1 text-2xl text-ink">
            {formatCents(budget.committedCents)}
          </p>
          <ProgressBar
            className="mt-3"
            percent={budget.percentCommitted}
            tone={budget.overBudget ? "danger" : "clay"}
          />
          <p className="mt-2 text-sm text-ink-mute">
            of {formatCents(budget.allocatedCents)}
            {budget.overBudget
              ? ` · ${formatCents(-budget.remainingCents)} over`
              : ` · ${formatCents(budget.remainingCents)} left`}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Tasks done</p>
          <p className="font-display tabular mt-1 text-2xl text-ink">
            {done}
            <span className="text-ink-mute"> / {total}</span>
          </p>
          <ProgressBar
            className="mt-3"
            percent={total ? (done / total) * 100 : 0}
            tone="forest"
          />
          <p className="mt-2 text-sm text-ink-mute">
            {total - done} still to do
          </p>
        </Card>
      </div>

      {/* What the event still needs — the reason this is a planner. */}
      <section>
        <SectionHeading
          title="What this event still needs"
          hint={
            outstanding.length === 0
              ? "Everything essential is booked."
              : `${outstanding.length} essential ${
                  outstanding.length === 1 ? "booking" : "bookings"
                } outstanding.`
          }
          action={
            <ButtonLink href={`/events/${event.id}/discover`} size="sm">
              Scout listings
            </ButtonLink>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coverage.map((row) => (
            <Card key={row.category} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{row.label}</p>
                <p className="mt-0.5 truncate text-sm text-ink-soft">
                  {row.bookedName
                    ? row.bookedName
                    : row.inFlight
                      ? "Enquiry out, no answer yet"
                      : "Nothing booked"}
                </p>
              </div>
              {row.bookedName ? (
                <Badge tone="forest">Booked</Badge>
              ) : row.inFlight ? (
                <Badge tone="amber">Waiting</Badge>
              ) : row.required ? (
                <Badge tone="clay">Needed</Badge>
              ) : (
                <Badge>Optional</Badge>
              )}
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading
            title="Next up"
            action={
              <Link
                href={`/events/${event.id}/plan`}
                className="text-sm font-medium text-clay hover:underline"
              >
                Full timeline
              </Link>
            }
          />
          {tasks.length === 0 ? (
            <EmptyState
              title="Nothing outstanding"
              body="Every task on the timeline is done."
            />
          ) : (
            <Card className="divide-y divide-line">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-4">
                  <span className="tabular mt-0.5 w-14 shrink-0 text-sm text-ink-mute">
                    {formatDue(task.dueDate)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink">{task.title}</p>
                    {task.notes ? (
                      <p className="mt-0.5 text-sm text-ink-soft">{task.notes}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <SectionHeading
            title="Where the money is going"
            action={
              <Link
                href={`/events/${event.id}/budget`}
                className="text-sm font-medium text-clay hover:underline"
              >
                Full budget
              </Link>
            }
          />
          <Card className="divide-y divide-line">
            {budget.rows.slice(0, 6).map((row) => (
              <div key={row.category} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-ink">{row.name}</p>
                  <p className="tabular text-sm text-ink-soft">
                    {formatCents(row.committedCents)}{" "}
                    <span className="text-ink-mute">
                      / {formatCents(row.allocatedCents)}
                    </span>
                  </p>
                </div>
                <ProgressBar
                  className="mt-2"
                  percent={row.percentOfAllocation}
                  tone={row.overCents > 0 ? "danger" : "clay"}
                />
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}
