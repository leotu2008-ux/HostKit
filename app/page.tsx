import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { currentProfile } from "@/lib/session";
import { CITIES, isCity, type City } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { groupByDay } from "@/lib/day-groups";
import { upcomingOnly } from "@/lib/upcoming";
import { CityDetector } from "@/components/city-detector";
import { EventCard } from "@/components/event-card";
import { ButtonLink, EmptyState, cx } from "@/components/ui";

export const metadata = { title: "Discover" };

const include = {
  owner: { select: { name: true } },
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

function toCard(event: {
  id: string;
  title: string;
  city: string;
  date: Date | null;
  durationHours: number;
  schoolDomain: string | null;
  owner?: { name: string } | null;
  _count: { guests: number };
}) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    date: event.date,
    durationHours: event.durationHours,
    going: event._count.guests,
    hostName: event.owner?.name,
    schoolDomain: event.schoolDomain,
  };
}

export default async function DiscoverPage({ searchParams }: PageProps<"/">) {
  const [user, query, jar] = await Promise.all([currentProfile(), searchParams, cookies()]);

  // Explicit choice → remembered detection → the student's home city → everywhere.
  const rawCity = Array.isArray(query.city) ? query.city[0] : query.city;
  const remembered = jar.get(CITY_COOKIE)?.value;
  let city: City | null = null;
  if (rawCity === "all") city = null;
  else if (isCity(rawCity)) city = rawCity;
  else if (isCity(remembered)) city = remembered;
  else city = user?.school?.city ?? null;
  const explicit = rawCity === "all" || isCity(rawCity);

  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly() };

  const [mine, campus, nearby] = await Promise.all([
    user
      ? db.event.findMany({
          where: { ownerId: user.id, ...upcomingOnly() },
          orderBy,
          take: 4,
          include,
        })
      : Promise.resolve([]),
    user?.schoolDomain
      ? db.event.findMany({
          where: { ...live, schoolDomain: user.schoolDomain, ownerId: { not: user.id } },
          orderBy,
          take: 12,
          include,
        })
      : Promise.resolve([]),
    db.event.findMany({
      where: {
        ...live,
        ...(city ? { city } : {}),
        ...(user ? { ownerId: { not: user.id } } : {}),
      },
      orderBy,
      take: 30,
      include,
    }),
  ]);

  const days = groupByDay(nearby);
  const cityShort = city ? city.split(",")[0] : null;
  const school = user?.school ?? null;

  return (
    <main className="relative isolate flex-1">
      {!explicit ? <CityDetector /> : null}
      {/* A soft wash of the brand colours behind the header. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(55%_90%_at_15%_0%,color-mix(in_srgb,var(--color-clay)_16%,transparent),transparent),radial-gradient(45%_80%_at_85%_0%,color-mix(in_srgb,var(--color-amber)_14%,transparent),transparent)]"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 md:px-8 md:pt-14">
        <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[46px]">
          {school
            ? `What’s on at ${school.short}`
            : user
              ? "What’s on next"
              : "Discover events"}
        </h1>
        <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          Student socials, professional mixers, and nights just for fun —
          register in a tap. Hosting? HostKit plans the rest.
        </p>
        {!user ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/events/new" size="lg">
              Create your event
            </ButtonLink>
            <ButtonLink href="/signin" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>
        ) : null}

        {user ? (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-ink">Your nights</h2>
              <Link href="/events" className="text-sm font-medium text-ink-soft hover:text-ink">
                View all →
              </Link>
            </div>
            {mine.length === 0 ? (
              <EmptyState
                title="Nothing coming up"
                body="Create a night and it shows up here. Publish it and it shows up for everyone."
                action={<ButtonLink href="/events/new">Create event</ButtonLink>}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {mine.map((event) => (
                  <li key={event.id}>
                    <EventCard
                      href={`/events/${event.id}`}
                      event={{ ...toCard(event), hostName: undefined, status: event.published ? "Published" : "Draft" }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {school ? (
          <section className="mt-12">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl text-ink">At {school.short}</h2>
                <p className="text-[13px] text-ink-mute">
                  Nights hosted by {school.name} students. Everyone’s welcome.
                </p>
              </div>
            </div>
            {campus.length === 0 ? (
              <EmptyState
                title={`Nothing at ${school.short} yet`}
                body="Host the first one — your events are tagged with your school automatically."
                action={<ButtonLink href="/events/new">Create event</ButtonLink>}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {campus.map((event) => (
                  <li key={event.id}>
                    <EventCard href={`/e/${event.id}`} event={toCard(event)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl text-ink">
              {cityShort ? `Around ${cityShort}` : "Upcoming everywhere"}
            </h2>
            <nav className="flex flex-wrap gap-1.5" aria-label="City">
              {[null, ...CITIES].map((option) => {
                const active = option === city;
                return (
                  <Link
                    key={option ?? "all"}
                    href={option ? `/?city=${encodeURIComponent(option)}` : "/?city=all"}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {option ? option.split(",")[0] : "Everywhere"}
                  </Link>
                );
              })}
            </nav>
          </div>

          {days.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={user ? "No other events yet" : "Nothing listed yet"}
                body={
                  user
                    ? "Your own public nights are under Your nights. Other hosts’ will show up here."
                    : "Be the first: create a night, make it public, and publish it."
                }
                action={<ButtonLink href="/events/new">Create a night</ButtonLink>}
              />
            </div>
          ) : (
            <ol className="mt-6 space-y-8">
              {days.map((day) => (
                <li key={day.key} className="md:grid md:grid-cols-[140px_1fr] md:gap-6">
                  <div className="mb-3 flex items-baseline gap-2 md:mb-0 md:block md:pt-3">
                    <p className="font-medium text-ink">{day.label}</p>
                    {day.relative ? (
                      <p className="text-[13px] text-ink-mute">{day.relative}</p>
                    ) : null}
                  </div>
                  <ul className="space-y-3 md:border-l md:border-dashed md:border-line-strong md:pl-6">
                    {day.items.map((event) => (
                      <li key={event.id}>
                        <EventCard href={`/e/${event.id}`} event={toCard(event)} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
