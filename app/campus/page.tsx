import Link from "next/link";
import { after } from "next/server";
import { currentProfile } from "@/lib/session";
import { SCHOOLS, schoolFor } from "@/lib/schools";
import { campusEventsFor } from "@/lib/campus/feed";
import { sourcesFor, SCHOOLS_WITH_FEEDS } from "@/lib/campus/sources";
import { lastSyncedAt, refreshIfStale } from "@/lib/campus/sync";
import { groupByDay } from "@/lib/day-groups";
import { EventCard, toCampusCard } from "@/components/event-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Campus events" };

/**
 * Everything on your school's official calendar, by day. `?school=mit.edu`
 * shows another school's. Official events open on the school's own site.
 */
export default async function CampusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, query] = await Promise.all([currentProfile(), searchParams]);
  const requested = Array.isArray(query.school) ? query.school[0] : query.school;
  const school = schoolFor(requested || user?.schoolDomain);

  const sources = sourcesFor(school?.domain);
  const [events, syncedAt] = school
    ? await Promise.all([campusEventsFor(school.domain, 300), lastSyncedAt(school.domain)])
    : [[], null];
  if (school) after(() => refreshIfStale(school.domain));

  const days = groupByDay(events.map((row) => ({ ...row, date: row.startsAt })));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-12 md:px-8 md:pt-14">
      <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[46px]">
        {school ? `On campus at ${school.short}` : "Campus events"}
      </h1>
      <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-ink-soft">
        {school
          ? `What ${school.name} itself has on: pulled from ${sources.map((s) => s.name).join(" and ") || "its calendar"}, refreshed a few times a day.`
          : "Pick your school in Settings and its official calendar shows up here, on Discover and in the app."}
      </p>
      {sources.length > 0 ? (
        <p className="mt-2 text-[13px] text-ink-mute">
          {sources.map((s, i) => (
            <span key={s.key}>
              {i > 0 ? " · " : ""}
              <a href={s.homepage} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                {s.name}
              </a>
            </span>
          ))}
          {syncedAt ? ` · synced ${syncedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : " · syncing…"}
        </p>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-1.5" aria-label="School">
        {SCHOOLS.filter((s) => SCHOOLS_WITH_FEEDS.has(s.domain)).map((s) => {
          const active = s.domain === school?.domain;
          return (
            <Link
              key={s.domain}
              href={`/campus?school=${s.domain}`}
              className={
                active
                  ? "rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-surface"
                  : "rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
              }
            >
              {s.short}
            </Link>
          );
        })}
      </nav>

      {!school ? (
        <div className="mt-8">
          <EmptyState
            title="Which school are you at?"
            body="Set it once in Settings — official events follow you everywhere."
            action={<ButtonLink href="/settings">Open Settings</ButtonLink>}
          />
        </div>
      ) : events.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={sources.length ? `Nothing synced for ${school.short} yet` : `No official feed for ${school.short} yet`}
            body={
              sources.length
                ? "The first sync runs in the background — check back in a minute."
                : "We haven't found a public calendar for this school. Student-hosted nights still show on Discover."
            }
            action={<ButtonLink href="/discover">Go to Discover</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {days.map((day) => (
            <section key={day.key}>
              <h2 className="mb-3 flex items-baseline gap-2 font-display text-xl text-ink">
                {day.label}
                {day.relative ? <span className="text-[14px] font-normal text-ink-mute">{day.relative}</span> : null}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {day.items.map((row) => {
                  const { href, ...card } = toCampusCard({ ...row, sourceName: sources.find((s) => s.key === row.sourceKey)?.name });
                  return (
                    <li key={row.id}>
                      <EventCard href={href} event={card} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
