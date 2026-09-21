import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { toggleTaskAction } from "@/lib/actions/tasks";
import { RedraftPlan } from "@/components/plan-forms";
import { daysBetween, startOfDay } from "@/lib/plan";
import { summarizeBudget } from "@/lib/budget";
import { computeCoverage, outstandingRequired } from "@/lib/coverage";
import { templateFor } from "@/lib/templates";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { briefIsComplete } from "@/lib/brief";
import { Badge, ButtonLink, Card, SectionHeading, cx } from "@/components/ui";

/** Groups the timeline into the buckets a host actually thinks in. */
function bucketFor(dueDate: Date | null, now: Date): string {
  if (!dueDate) return "Whenever";
  const days = daysBetween(now, dueDate);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days <= 7) return "This week";
  if (days <= 30) return "This month";
  if (days <= 90) return "Next three months";
  return "Later";
}

const BUCKET_ORDER = [
  "Overdue",
  "Today",
  "This week",
  "This month",
  "Next three months",
  "Later",
  "Whenever",
];

export default async function PlanPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  const now = startOfDay(new Date());

  const [tasks, categories, inquiries] = await Promise.all([
    db.task.findMany({
      where: { eventId: event.id },
      orderBy: [{ status: "asc" }, { offsetDays: "desc" }],
    }),
    db.budgetCategory.findMany({
      where: { eventId: event.id },
      include: { items: true },
    }),
    db.inquiry.findMany({
      where: { eventId: event.id },
      include: { listing: { select: { name: true, category: true } } },
    }),
  ]);
  const budget = summarizeBudget(categories);
  const coverage = computeCoverage(
    templateFor(event.type).required,
    categories.map((c) => c.category),
    inquiries,
  );
  const outstanding = outstandingRequired(coverage);

  const open = tasks.filter((t) => t.status === "TODO");
  const done = tasks.filter((t) => t.status === "DONE");

  const buckets = new Map<string, typeof tasks>();
  for (const task of open) {
    const key = bucketFor(task.dueDate, now);
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }
  const ordered = BUCKET_ORDER.filter((b) => buckets.has(b));

  return (
    <div className="space-y-10">
      <section className="grid gap-3">
        <Card className="p-4">
          <p className="text-sm text-ink-soft">Budget committed</p>
          <p className="tabular mt-1 text-[20px] font-semibold text-ink">
            {formatCents(budget.committedCents)}
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            of {formatCents(budget.allocatedCents)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-soft">Still needed</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">
            {outstanding.length === 0
              ? "Covered"
              : `${outstanding.length} essential ${
                  outstanding.length === 1 ? "booking" : "bookings"
                } outstanding`}
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading
          title="Timeline"
          hint={
            event.date
              ? "Counted back from your event date. Tick things off as you go."
              : "Add a date to the event and these will get real due dates."
          }
          action={
            briefIsComplete(event) ? (
              <RedraftPlan eventId={event.id} />
            ) : (
              // Redrafting against a blank/half-finished brief would plant a
              // MIXER/$0/no-date plan that then blocks the real one — see
              // regeneratePlanAction's own guard in lib/actions/plan.ts.
              <ButtonLink href={`/events/${event.id}/brief`} variant="secondary" size="sm">
                Finish the brief first
              </ButtonLink>
            )
          }
        />
        <p className="-mt-3 mb-4 text-xs text-ink-mute">
          Keeps anything you wrote or ticked off — only replaces what
          HostKit generated and you haven&rsquo;t started.
        </p>

        {open.length === 0 ? (
          <Card className="p-6 text-center text-ink-soft">
            Everything is ticked off. Enjoy the party.
          </Card>
        ) : (
          <div className="space-y-8">
            {ordered.map((bucket) => (
              <div key={bucket}>
                <h3
                  className={cx(
                    "mb-3 text-sm font-semibold tracking-wide uppercase",
                    bucket === "Overdue" ? "text-danger" : "text-ink-mute",
                  )}
                >
                  {bucket}
                </h3>
                <Card className="divide-y divide-line">
                  {buckets.get(bucket)!.map((task) => (
                    <TaskRow key={task.id} task={task} eventId={event.id} />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <section>
          <SectionHeading title={`Done (${done.length})`} />
          <Card className="divide-y divide-line">
            {done.map((task) => (
              <TaskRow key={task.id} task={task} eventId={event.id} />
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  eventId,
}: {
  task: {
    id: string;
    title: string;
    notes: string | null;
    dueDate: Date | null;
    status: string;
    category: keyof typeof CATEGORY_LABEL | null;
  };
  eventId: string;
}) {
  const isDone = task.status === "DONE";
  return (
    <div className="flex items-start gap-3 p-4">
      <form action={toggleTaskAction} className="pt-0.5">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={task.id} />
        <button
          type="submit"
          aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className={cx(
            "flex size-5 items-center justify-center rounded-md border transition-colors",
            isDone
              ? "border-forest bg-forest text-white"
              : "border-line-strong hover:border-ink-mute",
          )}
        >
          {isDone ? (
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cx("text-ink", isDone && "text-ink-mute line-through")}>
            {task.title}
          </p>
          {task.category ? (
            <Badge>{CATEGORY_LABEL[task.category]}</Badge>
          ) : null}
        </div>
        {task.notes && !isDone ? (
          <p className="mt-1 text-sm text-ink-soft">{task.notes}</p>
        ) : null}
      </div>

      <span className="tabular shrink-0 text-sm text-ink-mute">
        {task.dueDate
          ? task.dueDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "—"}
      </span>
    </div>
  );
}
