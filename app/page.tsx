import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { currentProfile } from "@/lib/session";
import { isCity } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { myUpcomingEvents } from "@/lib/mine";
import { followingEvents, followingOfficialEvents } from "@/lib/clubs";
import { upcomingOnly } from "@/lib/upcoming";
import { campusPreviewFor } from "@/lib/campus/feed";
import { CampusMixList, mixCampus } from "@/components/campus-mix";
import { CityDetector } from "@/components/city-detector";
import { SchoolPrompt } from "@/components/school-prompt";
import { EventCard, toEventCard as toCard } from "@/components/event-card";
import { EventTile } from "@/components/event-tile";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Home" };

const include = {
  owner: { select: { name: true } },
  club: { select: { handle: true, name: true, imageUrl: true } },
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

const ACTIONS = [
  { href: "/events/new", label: "Create an event", hint: "Name, time, place — publish when ready" },
  { href: "/discover", label: "Discover", hint: "What’s on near you and at your school" },
  { href: "/events", label: "My events", hint: "Everything you host, upcoming and past" },
  { href: "/profile", label: "Profile", hint: "Photo, school, phone, settings" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home: the brand, your events, where to go next, and a taste of what's
 * on nearby. Discover proper lives at /discover.
 */
export default async function HomePage() {
  const [user, jar] = await Promise.all([currentProfile(), cookies()]);
  const remembered = jar.get(CITY_COOKIE)?.value;
  const city = isCity(remembered) ? remembered : (user?.school?.city ?? null);
  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly() };

  const [mine, nearby, campus, following, official, followingOfficial] = await Promise.all([
    user ? myUpcomingEvents(user.id, 12) : Promise.resolve([]),
    db.event.findMany({
      where: { ...live, ...(city ? { city } : {}), ...(user ? { ownerId: { not: user.id } } : {}) },
      orderBy,
      take: 4,
      include,
    }),
    user?.schoolDomain
      ? db.event.findMany({
          where: { ...live, schoolDomain: user.schoolDomain, ownerId: { not: user.id } },
          orderBy,
          take: 2,
          include,
        })
      : Promise.resolve([]),
    user ? followingEvents(user.id, 4) : Promise.resolve([]),
    campusPreviewFor(user?.schoolDomain, 4),
    user ? followingOfficialEvents(user.id, 4) : Promise.resolve([]),
  ]);
  const fromClubs = mixCampus(following, followingOfficial, 4);
  const school = user?.school ?? null;
  const onCampus = mixCampus(campus, official, 4);
  const cityShort = city ? city.split(",")[0] : null;

  return (
    <main className="relative isolate flex-1">
      {!remembered ? <CityDetector /> : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(55%_90%_at_15%_0%,color-mix(in_srgb,var(--color-brand)_10%,transparent),transparent),radial-gradient(45%_80%_at_85%_0%,color-mix(in_srgb,var(--color-clay)_5%,transparent),transparent)]"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 md:px-8 md:pt-14">
        {/* The brand, at the top of the screen. */}
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={44} height={44} priority className="h-11 w-11 rounded-[12px] ring-1 ring-line" />
          <p className="font-event text-[28px] leading-none text-ink md:text-[32px]">
            Student <span className="text-brand">Events</span>
          </p>
        </div>
        <h1 className="font-display mt-6 text-[34px] leading-[1.1] text-ink md:text-[46px]">
          {user ? `${greeting()}, ${user.name.split(" ")[0]}` : "Sell the ticket. Run the door."}
        </h1>
        <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          {user
            ? "Here’s what’s coming up for you, and what’s on around you."
            : "Formals, mixers, and nights your org actually charges for. Put a ticket on sale in a minute and scan people in at the door."}
        </p>
        {!user ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/events/new" size="lg">
              Create an event
            </ButtonLink>
            <ButtonLink href="/discover" variant="secondary" size="lg">
              Discover events
            </ButtonLink>
          </div>
        ) : null}

        {user && !user.schoolDomain ? <SchoolPrompt /> : null}

        <section className="mt-10" aria-labelledby="your-events">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="your-events" className="font-display text-xl text-ink">
              Your events
            </h2>
            {user ? (
              <Link href="/events" className="text-sm font-medium text-ink-soft hover:text-ink">
                View all →
              </Link>
            ) : null}
          </div>
          {!user ? (
            <div className="rounded-card border border-line bg-surface p-5 md:flex md:items-center md:justify-between md:gap-6">
              <div>
                <p className="text-lg font-semibold text-ink">Sign in to see your events here</p>
                <p className="mt-1 max-w-md text-[15px] text-ink-soft">
                  What you host and what you’re going to, soonest first. Students: use your school .edu email.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
                <ButtonLink href="/signin" variant="secondary" size="lg">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" variant="secondary" size="lg">
                  Create an account
                </ButtonLink>
              </div>
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              title="Nothing coming up"
              body="Create an event and it shows up here — so does anything you register for."
              action={<ButtonLink href="/events/new">Create an event</ButtonLink>}
            />
          ) : (
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {mine.map((event) => (
                <li key={event.id} className="shrink-0">
                  <EventTile event={event} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {fromClubs.length > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-ink">From clubs you follow</h2>
              <Link href="/clubs" className="text-sm font-medium text-ink-soft hover:text-ink">
                Your clubs →
              </Link>
            </div>
            <CampusMixList rows={fromClubs} />
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="font-display mb-3 text-xl text-ink">Where to next</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
                >
                  <span>
                    <span className="block font-medium text-ink">{action.label}</span>
                    <span className="block text-[13px] text-ink-mute">{action.hint}</span>
                  </span>
                  <span aria-hidden className="text-ink-mute">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {school && onCampus.length > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-ink">At {school.short}</h2>
              <Link href="/campus" className="text-sm font-medium text-ink-soft hover:text-ink">
                See all →
              </Link>
            </div>
            <CampusMixList rows={onCampus} />
          </section>
        ) : null}

        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-ink">
              {cityShort ? `Happening around ${cityShort}` : "Happening soon"}
            </h2>
            <Link href="/discover" className="text-sm font-medium text-ink-soft hover:text-ink">
              See all →
            </Link>
          </div>
          {nearby.length === 0 ? (
            <EmptyState
              title="Nothing listed yet"
              body="Be the first: create an event, make it public, and publish it."
              action={<ButtonLink href="/events/new">Create an event</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {nearby.map((event) => (
                <li key={event.id}>
                  <EventCard href={`/e/${event.id}`} event={toCard(event)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
