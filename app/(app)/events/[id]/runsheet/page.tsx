import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { formatTime } from "@/lib/runsheet";
import {
  clearRunSheetAction,
  removeRunSheetItemAction,
} from "@/lib/actions/runsheet";
import {
  AddRunSheetItem,
  GenerateRunSheet,
} from "@/components/runsheet-forms";
import { PrintButton } from "@/components/print-button";
import { Card, EmptyState, SectionHeading } from "@/components/ui";

export default async function RunSheetPage({
  params,
}: PageProps<"/events/[id]/runsheet">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const items = await db.runSheetItem.findMany({
    where: { eventId: event.id },
    orderBy: { startsAt: "asc" },
  });

  if (!event.date) {
    return (
      <EmptyState
        title="This event needs a date first"
        body="A run sheet is a schedule for one particular day. Add the date to your event and come back."
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No run sheet yet"
          body="Student Events can draft one from your bookings — load-in times for every vendor you've booked, the setup steps people forget, and a running order for this kind of event. Every line is editable."
          action={<GenerateRunSheet eventId={event.id} />}
        />
        <Card className="p-5">
          <SectionHeading title="Or add the first line yourself" />
          <AddRunSheetItem eventId={event.id} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">
            {event.date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            A draft built from your bookings. Change anything that isn&rsquo;t
            right — the times are suggestions, not instructions.
          </p>
        </div>
        <div className="flex gap-3">
          <PrintButton />
          <form action={clearRunSheetAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              className="h-10 rounded-full px-4 text-sm font-medium text-ink-mute hover:text-danger"
            >
              Clear and start over
            </button>
          </form>
        </div>
      </div>

      {/* The print view: this is what gets handed to whoever is running the
          day, so it has to survive being on paper. */}
      <div className="hidden print:mb-6 print:block">
        <h1 className="font-display text-2xl">{event.title} — run sheet</h1>
        <p className="text-sm">
          {event.date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {event.city}
        </p>
      </div>

      <Card className="divide-y divide-line print:border-0">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-4 p-4">
            <span className="tabular font-display w-20 shrink-0 text-ink">
              {formatTime(item.startsAt)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ink">{item.title}</p>
              {item.owner ? (
                <p className="mt-0.5 text-sm text-ink-soft">{item.owner}</p>
              ) : null}
              {item.notes ? (
                <p className="mt-0.5 text-sm text-ink-mute">{item.notes}</p>
              ) : null}
            </div>
            <form action={removeRunSheetItemAction} className="no-print">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                aria-label={`Remove ${item.title}`}
                className="text-sm text-ink-mute hover:text-danger"
              >
                Remove
              </button>
            </form>
          </div>
        ))}
      </Card>

      <Card className="no-print p-5">
        <SectionHeading title="Add a line" />
        <AddRunSheetItem eventId={event.id} />
      </Card>
    </div>
  );
}
