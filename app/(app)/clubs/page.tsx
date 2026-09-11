import { cookies } from "next/headers";
import { isCity } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { currentProfile } from "@/lib/session";
import { clubsFor, followedClubIds, suggestedClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { clubSelect } from "@/lib/clubs";
import { ClubCard } from "@/components/club-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Clubs" };

/** Your clubs, the ones you follow, and the ones around you. */
export default async function ClubsPage() {
  const [user, jar] = await Promise.all([currentProfile(), cookies()]);
  const remembered = jar.get(CITY_COOKIE)?.value;
  const city = isCity(remembered) ? remembered : (user?.school?.city ?? null);
  const [mine, followingIds, suggested] = await Promise.all([
    user ? clubsFor(user.id) : Promise.resolve([]),
    followedClubIds(user?.id ?? null),
    suggestedClubs({ schoolDomain: user?.schoolDomain ?? null, city }, 24),
  ]);
  const following = followingIds.size
    ? await db.club.findMany({ where: { id: { in: [...followingIds] } }, orderBy: { name: "asc" }, select: clubSelect })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Clubs</h1>
        <ButtonLink href="/clubs/new" size="sm">
          Start a club
        </ButtonLink>
      </div>

      {user ? (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl text-ink">Your clubs</h2>
          {mine.length === 0 ? (
            <EmptyState title="You don’t run a club yet" body="Start a page and post events as the club." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {mine.map((club) => (
                <li key={club.id}>
                  <ClubCard club={club} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {following.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl text-ink">Following</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {following.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display mb-3 text-xl text-ink">
          {user?.school ? `At ${user.school.short}` : city ? `In ${city.split(",")[0]}` : "Around"}
        </h2>
        {suggested.length === 0 ? (
          <EmptyState title="No clubs here yet" body="Be the first — start a page for yours." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {suggested.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
