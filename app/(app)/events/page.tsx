import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "My events" };

export default async function EventsPage() {
  const user = await requireUser();
  const events = await db.event.findMany({
    where: { ownerId: user.id },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">My events</h1>
        <ButtonLink href="/events/new">Plan an event</ButtonLink>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Answer six quick questions and HostKit will build the timeline, the budget and the vendor checklist for you."
          action={<ButtonLink href="/events/new">Plan an event</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <a
                href={`/events/${event.id}`}
                className="block rounded-card border border-line bg-surface p-5 hover:border-line-strong"
              >
                <p className="font-display text-lg text-ink">{event.title}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {event.city} · {event.guestCount} guests
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
