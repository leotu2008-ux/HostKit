import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageClub, clubByHandle, clubPastEvents, clubUpdates, followedClubIds, officialClubEvents, officialSourceKey } from "@/lib/clubs";
import { clubCategoryLabel } from "@/lib/club-format";
import { sourceByKey } from "@/lib/campus/sources";
import { schoolFor } from "@/lib/schools";
import { upcomingOnly } from "@/lib/upcoming";
import { eventInclude } from "@/lib/api/serialize";
import { Avatar } from "@/components/avatar";
import { CampusMixList, mixCampus } from "@/components/campus-mix";
import { ClubUpdateForm } from "@/components/club-update-form";
import { ClubUpdates } from "@/components/club-updates";
import { EventCard, toEventCard } from "@/components/event-card";
import { FollowButton } from "@/components/follow-button";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const club = await clubByHandle((await params).handle);
  return { title: club ? club.name : "Club" };
}

/** A club's public page: who they are, what's coming up, follow. */
export default async function ClubPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [user, club] = await Promise.all([getCurrentUser(), clubByHandle(handle)]);
  if (!club) notFound();

  const [following, canManage, events, members, past, updates, official] = await Promise.all([
    followedClubIds(user?.id ?? null),
    canManageClub(user?.id ?? null, club.id),
    db.event.findMany({
      where: { clubId: club.id, published: true, visibility: { not: "PRIVATE" }, ...upcomingOnly() },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 20,
      include: eventInclude,
    }),
    db.clubMember.findMany({
      where: { clubId: club.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { role: true, user: { select: { id: true, name: true, imageUrl: true } } },
    }),
    clubPastEvents(club.id, 6),
    clubUpdates(club.id, 10),
    officialClubEvents(club, 20),
  ]);
  const school = schoolFor(club.schoolDomain);
  const category = clubCategoryLabel(club.category);
  const source = sourceByKey(officialSourceKey(club) ?? "");
  const upcoming = mixCampus(events, official, 40);

  return (
    <main className="relative isolate flex-1">
      <div className="relative h-40 w-full bg-sunk md:h-56">
        {club.coverUrl ? (
          <Image src={club.coverUrl} alt="" fill sizes="100vw" className="object-cover" priority />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(55%_90%_at_15%_0%,color-mix(in_srgb,var(--color-wash)_10%,transparent),transparent),radial-gradient(45%_80%_at_85%_0%,color-mix(in_srgb,var(--color-clay)_5%,transparent),transparent)]"
          />
        )}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 md:px-8">
        <div className="-mt-10 flex flex-wrap items-end gap-4 md:-mt-12">
          <Avatar name={club.name} imageUrl={club.imageUrl} size={88} className="rounded-2xl ring-4 ring-paper" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-[30px] leading-tight text-ink md:text-[38px]">{club.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ink-soft">
              <span className="font-mono text-ink-mute">/c/{club.handle}</span>
              {school ? <Badge tone="clay">{school.name}</Badge> : null}
              {category ? <Badge>{category}</Badge> : null}
              {club.isOfficial ? <Badge>Official</Badge> : null}
              {club.city ? <span>{club.city.split(",")[0]}</span> : null}
              <span>
                <span className="tabular font-medium text-ink">{club._count.followers}</span>{" "}
                {club._count.followers === 1 ? "follower" : "followers"}
              </span>
              {past.total > 0 ? (
                <span>
                  <span className="tabular font-medium text-ink">{past.total}</span>{" "}
                  {past.total === 1 ? "event hosted" : "events hosted"}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-1">
            {canManage ? (
              <ButtonLink href={`/c/${club.handle}/edit`} variant="secondary" size="sm">
                Manage
              </ButtonLink>
            ) : null}
            <FollowButton handle={club.handle} following={following.has(club.id)} />
          </div>
        </div>

        {club.blurb ? <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-soft">{club.blurb}</p> : null}

        {canManage || updates.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display mb-3 text-xl text-ink">Updates</h2>
            {canManage ? (
              <div className="mb-4 rounded-card border border-line bg-surface p-4">
                <ClubUpdateForm handle={club.handle} followers={club._count.followers} />
              </div>
            ) : null}
            {updates.length === 0 ? (
              <p className="text-[14px] text-ink-mute">
                Nothing posted yet. A short note here goes straight to every follower.
              </p>
            ) : (
              <ClubUpdates handle={club.handle} updates={updates} canManage={canManage} />
            )}
          </section>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <h2 className="font-display mb-3 text-xl text-ink">Coming up</h2>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing scheduled yet"
                body={
                  canManage
                    ? "Post an event as the club and it lands here for followers."
                    : club.isOfficial
                      ? `Follow to hear when ${club.name} puts something on the school calendar.`
                      : "Follow to hear the moment they post one."
                }
                action={canManage ? <ButtonLink href="/events/new">Create an event</ButtonLink> : undefined}
              />
            ) : (
              <CampusMixList rows={upcoming} />
            )}

            {past.rows.length > 0 ? (
              <>
                <h2 className="font-display mt-10 mb-3 text-xl text-ink">Past events</h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {past.rows.map((event) => (
                    <li key={event.id} className="opacity-80">
                      <EventCard href={`/e/${event.id}`} event={toEventCard(event)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <aside>
            {club.isOfficial && members.length === 0 ? (
              <>
                <h2 className="font-display mb-3 text-xl text-ink">About this page</h2>
                <p className="text-[14px] leading-relaxed text-ink-soft">
                  A real {school ? school.short : "campus"} organisation, listed from{" "}
                  {source ? (
                    <a href={source.homepage} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                      {source.name}
                    </a>
                  ) : (
                    "the school's calendar"
                  )}
                  . Its events sync from there; follow it to see them on Home.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display mb-3 text-xl text-ink">Run by</h2>
                <ul className="space-y-3">
                  {members.map((m) => (
                    <li key={m.user.id} className="flex items-center gap-3">
                      <Avatar name={m.user.name} imageUrl={m.user.imageUrl} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{m.user.name}</span>
                        <span className="block text-[12px] text-ink-mute">{m.role === "OWNER" ? "Owner" : "Admin"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-6 text-[13px] text-ink-mute">
              Run a club too? <Link href="/clubs/new" className="text-clay">Start a page</Link>.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
