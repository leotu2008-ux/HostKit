import { db } from "@/lib/db";
import { getCurrentUser, managedClubIds } from "@/lib/session";
import { EventCard } from "@/components/event-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const managed = user ? await managedClubIds(user.id) : [];

  const [mine, nearby] = await Promise.all([
    user
      ? db.event.findMany({
          where: {
            OR: [{ ownerId: user.id }, { clubId: { in: managed } }],
          },
          orderBy: [{ date: "asc" }, { createdAt: "desc" }],
          take: 8,
          include: {
            _count: {
              select: { guests: { where: { rsvpStatus: "ATTENDING" } } },
            },
          },
        })
      : Promise.resolve([]),
    db.event.findMany({
      where: {
        published: true,
        visibility: "PUBLIC",
        // Not yours, and not your club's — those are in the list above.
        ...(user
          ? { ownerId: { not: user.id }, NOT: { clubId: { in: managed } } }
          : {}),
      },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 24,
      include: {
        owner: { select: { name: true } },
        club: { select: { name: true } },
        _count: {
          select: { guests: { where: { rsvpStatus: "ATTENDING" } } },
        },
      },
    }),
  ]);

  return (
    <main className="flex-1 px-4 pb-8 pt-5">
      <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
        Discover
      </p>
      <h1 className="font-display mt-1 text-[28px] leading-tight text-ink">
        {user ? "What are you hosting next?" : "Find a night."}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        {user
          ? "Your drafts and published nights, plus what’s happening nearby."
          : "Public events with a tap to register. Hosts plan the rest in HostKit."}
      </p>

      {user ? (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-lg text-ink">Your nights</h2>
            <ButtonLink href="/events/new" size="sm">
              Create
            </ButtonLink>
          </div>
          {mine.length === 0 ? (
            <EmptyState
              title="No events yet"
              body="Six questions. HostKit builds the plan — you can publish it to Discover when you’re ready."
              action={<ButtonLink href="/events/new">Create event</ButtonLink>}
            />
          ) : (
            <ul className="space-y-2.5">
              {mine.map((event) => (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="mt-6 flex gap-2">
          <ButtonLink href="/events/new" size="lg" className="flex-1">
            Plan an event
          </ButtonLink>
          <ButtonLink href="/signin" variant="secondary" size="lg" className="flex-1">
            Sign in
          </ButtonLink>
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg text-ink">Happening nearby</h2>
        <p className="mt-1 mb-3 text-sm text-ink-mute">
          Public nights you can register for — no account required.
        </p>
        {nearby.length === 0 ? (
          <EmptyState
            title="Nothing listed this month"
            body="Be the first. Create a night and turn on Publish to Discover."
            action={
              user ? (
                <ButtonLink href="/events/new">Create event</ButtonLink>
              ) : (
                <ButtonLink href="/events/new">Create a night</ButtonLink>
              )
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {nearby.map((event) => (
              <li key={event.id}>
                <EventCard
                  href={`/e/${event.id}`}
                  event={{
                    id: event.id,
                    title: event.title,
                    city: event.city,
                    date: event.date,
                    durationHours: event.durationHours,
                    going: event._count.guests,
                    hostName: event.club?.name ?? event.owner?.name,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
