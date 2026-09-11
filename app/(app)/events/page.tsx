import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readDraftClaims } from "@/lib/drafts";
import { groupByDay } from "@/lib/day-groups";
import { pastOnly, upcomingOnly } from "@/lib/upcoming";
import { EventCard } from "@/components/event-card";
import { ButtonLink, EmptyState, cx } from "@/components/ui";

export const metadata = { title: "My events" };

const goingCount = {
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};

export default async function EventsPage({
  searchParams,
}: PageProps<"/events">) {
  const query = await searchParams;
  const tab = query.tab === "past" ? "past" : "upcoming";
  const when = tab === "past" ? pastOnly() : upcomingOnly();
  const order =
    tab === "past"
      ? [{ date: "desc" as const }]
      : [{ date: "asc" as const }, { createdAt: "desc" as const }];

  const user = await getCurrentUser();
  const claims = await readDraftClaims();

  const events = user
    ? await db.event.findMany({
        where: { ownerId: user.id, ...when },
        orderBy: order,
        include: goingCount,
      })
    : claims.length > 0
      ? await db.event.findMany({
          where: {
            id: { in: claims.map((c) => c.id) },
            ownerId: null,
            ...when,
          },
          orderBy: order,
          include: goingCount,
        })
      : [];

  const days = groupByDay(events);

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">
          Events
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-sunk p-1" role="tablist">
            {(["upcoming", "past"] as const).map((option) => (
              <Link
                key={option}
                href={option === "past" ? "/events?tab=past" : "/events"}
                role="tab"
                aria-selected={tab === option}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium capitalize",
                  tab === option
                    ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {option}
              </Link>
            ))}
          </div>
          <ButtonLink href="/events/new" size="sm" className="md:hidden">
            Create
          </ButtonLink>
        </div>
      </div>

      {!user ? (
        <p className="mb-6 rounded-card bg-sunk px-4 py-3 text-sm text-ink-soft">
          Drafts live in this browser until you{" "}
          <Link href="/signin" className="font-medium text-clay">
            sign in
          </Link>{" "}
          to publish them.
        </p>
      ) : null}

      {days.length === 0 ? (
        <EmptyState
          title={tab === "past" ? "No past events" : "No upcoming events"}
          body={
            tab === "past"
              ? "Nights you've hosted will collect here."
              : "Name, time, place, tickets. You can save a night before you have an account."
          }
          action={
            tab === "past" ? undefined : (
              <ButtonLink href="/events/new">Create event</ButtonLink>
            )
          }
        />
      ) : (
        <ol className="relative space-y-8">
          {days.map((day) => (
            <li key={day.key} className="md:grid md:grid-cols-[150px_1fr] md:gap-6">
              <div className="mb-3 flex items-center gap-2.5 md:mb-0 md:items-start md:pt-3">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-ink-mute md:mt-2"
                />
                <div className="flex items-baseline gap-2 md:block">
                  <p className="font-medium text-ink">{day.label}</p>
                  {day.relative ? (
                    <p className="text-[13px] text-ink-mute">{day.relative}</p>
                  ) : null}
                </div>
              </div>
              <ul className="space-y-3 border-l border-dashed border-line-strong pl-5 md:pl-6">
                {day.items.map((event) => (
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
                        schoolDomain: event.schoolDomain,
                        coverUrl: event.coverUrl,
                        status: event.published
                          ? event.visibility === "PUBLIC"
                            ? "Public"
                            : event.visibility === "UNLISTED"
                              ? "Unlisted"
                              : "Private"
                          : user
                            ? "Draft"
                            : "Draft on this device",
                      }}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
