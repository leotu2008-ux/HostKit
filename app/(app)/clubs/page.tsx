import { cookies } from "next/headers";
import { isCity } from "@/lib/catalog";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { currentProfile } from "@/lib/session";
import { clubsFor, followedClubIds, searchClubs, suggestedClubs } from "@/lib/clubs";
import { clubCategoryLabel, isClubCategory } from "@/lib/club-format";
import { db } from "@/lib/db";
import { clubSelect } from "@/lib/clubs";
import { ClubBrowse } from "@/components/club-browse";
import { ClubCard } from "@/components/club-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Clubs" };

/** Your clubs, the ones you follow, the ones around you — and a search over all of them. */
export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, jar, query] = await Promise.all([currentProfile(), cookies(), searchParams]);
  const remembered = jar.get(CITY_COOKIE)?.value;
  const city = isCity(remembered) ? remembered : (user?.school?.city ?? null);
  const rawQ = Array.isArray(query.q) ? query.q[0] : query.q;
  const q = (rawQ ?? "").trim().slice(0, 80);
  const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
  const category = isClubCategory(rawCategory) ? rawCategory : null;
  const browsing = q.length > 0 || category !== null;

  const [mine, followingIds, suggested, results] = await Promise.all([
    user ? clubsFor(user.id) : Promise.resolve([]),
    followedClubIds(user?.id ?? null),
    browsing ? Promise.resolve([]) : suggestedClubs({ schoolDomain: user?.schoolDomain ?? null, city }, 24),
    searchClubs({ q, category, schoolDomain: user?.schoolDomain ?? null }),
  ]);
  const following =
    followingIds.size && !browsing
      ? await db.club.findMany({ where: { id: { in: [...followingIds] } }, orderBy: { name: "asc" }, select: clubSelect })
      : [];

  const resultsTitle = [q ? `“${q}”` : null, clubCategoryLabel(category)].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Clubs</h1>
        <ButtonLink href="/clubs/new" size="sm">
          Start a club
        </ButtonLink>
      </div>

      <div className="mt-6">
        <ClubBrowse q={q} category={category} />
      </div>

      {browsing ? (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl text-ink">{resultsTitle}</h2>
          {results.length === 0 ? (
            <EmptyState
              title="No clubs match"
              body="Try another word or kind — or start the club yourself."
              action={<ButtonLink href="/clubs/new">Start a club</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((club) => (
                <li key={club.id}>
                  <ClubCard club={club} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
