import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EventCard } from "@/components/event-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "My events" };

export default async function EventsPage() {
  const user = await requireUser();
  const events = await db.event.findMany({
    where: { ownerId: user.id },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { guests: { where: { rsvpStatus: "ATTENDING" } } },
      },
    },
  });

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="font-display text-[28px] text-ink">My events</h1>
        <ButtonLink href="/events/new" size="sm">
          Create
        </ButtonLink>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Answer six quick questions and HostKit will build the timeline, the budget and the vendor checklist for you."
          action={<ButtonLink href="/events/new">Create event</ButtonLink>}
        />
      ) : (
        <ul className="space-y-2.5">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard
                href={`/events/${event.id}`}
                event={{
                  id: event.id,
                  title: event.title,
                  city: event.city,
                  date: event.date,
                  durationHours: event.durationHours,
                  going: event._count.guests,
                }}
              />
              <p className="mt-1 px-1 text-[12px] text-ink-mute">
                {event.published ? "Public on Discover" : "Unlisted draft"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
