import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { currentProfile } from "@/lib/session";
import { CITIES, isCity, type City } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { groupByDay } from "@/lib/day-groups";
import { upcomingOnly } from "@/lib/upcoming";
import { suggestedClubs } from "@/lib/clubs";
import { campusPreviewFor } from "@/lib/campus/feed";
import { sourcesFor } from "@/lib/campus/sources";
import { CampusMixByDay, mixCampus } from "@/components/campus-mix";
import { CityDetector } from "@/components/city-detector";
import { SearchBox } from "@/components/search-box";
import { eventSearch, searchTerm } from "@/lib/search";
import { ClubCard } from "@/components/club-card";
import { EventCard, toEventCard as toCard } from "@/components/event-card";
import { ButtonLink, EmptyState, cx } from "@/components/ui";

export const metadata = { title: "Discover" };

const include = {
  owner: { select: { name: true } },
  club: { select: { handle: true, name: true, imageUrl: true } },
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

/** Everything public and upcoming: your campus first, then the city. */
export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
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
  const q = searchTerm(query.q);
  const searching = q.length > 0;

  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly(), ...eventSearch(q) };

  const [campus, nearby, clubs, official] = await Promise.all([
    user?.schoolDomain
      ? db.event.findMany({
          where: { ...live, schoolDomain: user.schoolDomain, ownerId: { not: user.id } },
          orderBy,
          take: searching ? 30 : 12,
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
      take: searching ? 60 : 30,
      include,
    }),
    searching ? Promise.resolve([]) : suggestedClubs({ schoolDomain: user?.schoolDomain ?? null, city }, 8),
    campusPreviewFor(user?.schoolDomain, searching ? 60 : 12, q),
  ]);

  const days = groupByDay(nearby);
  const cityShort = city ? city.split(",")[0] : null;
  const school = user?.school ?? null;
  const onCampus = mixCampus(campus, official, searching ? 60 : 8);
  const feeds = sourcesFor(school?.domain);
  const nothingFound = searching && onCampus.length === 0 && nearby.length === 0;

  return (
    <main className="relative isolate flex-1">
      {!explicit ? <CityDetector /> : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(55%_90%_at_15%_0%,color-mix(in_srgb,var(--color-brand)_10%,transparent),transparent),radial-gradient(45%_80%_at_85%_0%,color-mix(in_srgb,var(--color-clay)_5%,transparent),transparent)]"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 md:px-8 md:pt-14">
        <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[46px]">
          {school ? `What’s on at ${school.short}` : "Discover"}
        </h1>
        <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          Student socials, professional mixers, and nights just for fun —
          register in a tap.
        </p>

        <SearchBox q={q} city={rawCity} className="mt-6" />

        {nothingFound ? (
          <div className="mt-8">
            <EmptyState
              title={`Nothing for “${q}”`}
              body="Try another word — a host, a club, a place — or clear the search."
              action={<ButtonLink href={city ? `/discover?city=${encodeURIComponent(city)}` : "/discover"} variant="secondary">Clear search</ButtonLink>}
            />
          </div>
        ) : null}

        {clubs.length > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-ink">
                {school ? `Clubs at ${school.short}` : cityShort ? `Clubs in ${cityShort}` : "Clubs"}
              </h2>
              <Link href="/clubs" className="text-sm font-medium text-ink-soft hover:text-ink">
                See all →
              </Link>
            </div>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {clubs.map((club) => (
                <li key={club.id} className="shrink-0">
                  <ClubCard club={club} compact />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {school && !(searching && onCampus.length === 0) ? (
          <section className="mt-10">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl text-ink">At {school.short}</h2>
                <p className="text-[13px] text-ink-mute">
                  {feeds.length > 0
                    ? `Nights hosted by ${school.name} students, and the school’s official calendar.`
                    : `Nights hosted by ${school.name} students. Everyone’s welcome.`}
                </p>
              </div>
              <Link href="/campus" className="text-sm font-medium text-ink-soft hover:text-ink">
                {feeds.length > 0 ? "All campus events →" : "Campus events →"}
              </Link>
            </div>
            {onCampus.length === 0 ? (
              <EmptyState
                title={`Nothing at ${school.short} yet`}
                body={
                  feeds.length > 0
                    ? "The official calendar syncs in the background — or host the first night yourself."
                    : "Host the first one — your events are tagged with your school automatically."
                }
                action={<ButtonLink href="/events/new">Create event</ButtonLink>}
              />
            ) : (
              <CampusMixByDay rows={onCampus} />
            )}
          </section>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl text-ink">
              {searching
                ? `“${q}” ${cityShort ? `around ${cityShort}` : "everywhere"}`
                : cityShort ? `Around ${cityShort}` : "Upcoming everywhere"}
            </h2>
            <nav className="flex flex-wrap gap-1.5" aria-label="City">
              {[null, ...CITIES].map((option) => {
                const active = option === city;
                return (
                  <Link
                    key={option ?? "all"}
                    href={`/discover?city=${option ? encodeURIComponent(option) : "all"}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
                title={searching ? `Nothing for “${q}” ${cityShort ? `around ${cityShort}` : "here"}` : user ? "No other events yet" : "Nothing listed yet"}
                body={
                  searching
                    ? "Try another city chip, or a different word."
                    : user
                      ? "Your own public events are on Home. Other hosts’ will show up here."
                      : "Be the first: create an event, make it public, and publish it."
                }
                action={<ButtonLink href="/events/new">Create an event</ButtonLink>}
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
