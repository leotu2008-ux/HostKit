import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { Card, EmptyState } from "@/components/ui";

export const metadata = { title: "All events" };

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Every event on Hosty, whoever owns it, for the administrator to prune.
 *  Anyone else gets a 404 — the page doesn't admit it exists. */
export default async function AdminEventsPage() {
  const user = await requireUser("/admin/events");
  if (!isAdmin(user)) notFound();

  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      createdAt: true,
      owner: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">All events</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {events.length} {events.length === 1 ? "event" : "events"} across every host. Removing one deletes its guests,
        outreach and activity for good.
      </p>

      {events.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No events" body="Nobody has made an event yet." />
        </div>
      ) : (
        <Card className="mt-6 divide-y divide-line overflow-hidden">
          {events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{event.title}</p>
                <p className="text-[13px] text-ink-mute">
                  {event.owner ? `${event.owner.name} · ${event.owner.email}` : "No owner (unclaimed draft)"}
                  {" · "}
                  {event.date ? WHEN.format(event.date) : `created ${WHEN.format(event.createdAt)}`}
                </p>
              </div>
              <AdminDeleteButton eventId={event.id} title={event.title} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
