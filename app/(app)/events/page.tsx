import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readDraftClaims } from "@/lib/drafts";
import { EventCard } from "@/components/event-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "My events" };

export default async function EventsPage() {
  const user = await getCurrentUser();
  const claims = await readDraftClaims();

  const events = user
    ? await db.event.findMany({
        where: { ownerId: user.id },
        orderBy: [{ date: "asc" }, { createdAt: "desc" }],
        include: {
          _count: {
            select: { guests: { where: { rsvpStatus: "ATTENDING" } } },
          },
        },
      })
    : claims.length > 0
      ? await db.event.findMany({
          where: {
            id: { in: claims.map((c) => c.id) },
            ownerId: null,
          },
          orderBy: [{ date: "asc" }, { createdAt: "desc" }],
          include: {
            _count: {
              select: { guests: { where: { rsvpStatus: "ATTENDING" } } },
            },
          },
        })
      : [];

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="font-display text-[28px] text-ink">My events</h1>
        <ButtonLink href="/events/new" size="sm">
          Create
        </ButtonLink>
      </div>

      {!user ? (
        <p className="mb-4 rounded-card bg-sunk px-4 py-3 text-sm text-ink-soft">
          Drafts live in this browser until you{" "}
          <a href="/signin" className="font-medium text-clay">
            sign in
          </a>{" "}
          to publish them.
        </p>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Name, time, place, tickets. You can save a night before you have an account."
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
                {event.published
                  ? event.visibility === "PUBLIC"
                    ? "Public on Discover"
                    : event.visibility === "UNLISTED"
                      ? "Unlisted link"
                      : "Private"
                  : user
                    ? "Unpublished draft"
                    : "Draft on this device"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
