import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clubRoleFor, getCurrentUser } from "@/lib/session";
import { canManageClub } from "@/lib/clubs";
import { CoverArt } from "@/components/cover-art";
import { EventCard } from "@/components/event-card";
import { ClubMembership } from "@/components/club-membership";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const club = await db.club.findUnique({ where: { slug }, select: { name: true } });
  return { title: club?.name ?? "Club" };
}

/**
 * A club's public page: what it is, who's in it, what's coming up, and the
 * button to join. Public by design — this is the link a club shares — but
 * signed-in admins get the management affordances inline.
 */
export default async function ClubPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;

  const club = await db.club.findUnique({
    where: { slug },
    include: { _count: { select: { members: true } } },
  });
  if (!club) notFound();

  const user = await getCurrentUser();
  const [role, nights] = await Promise.all([
    clubRoleFor(club.id, user?.id ?? null),
    db.event.findMany({
      where: {
        clubId: club.id,
        published: true,
        // Unlisted nights are reachable by link, and the club page is a link.
        visibility: { in: ["PUBLIC", "UNLISTED"] },
      },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
      },
    }),
  ]);

  const manages = canManageClub(role);
  const now = new Date();
  const upcoming = nights.filter((n) => !n.date || n.date >= now);
  const past = nights.filter((n) => n.date && n.date < now);

  return (
    <div className="px-4 py-6">
      <header className="flex items-start gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-sunk">
          <CoverArt id={club.id} title={club.name} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight text-ink">
            {club.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {club.city ? `${club.city} · ` : ""}
            {club._count.members}{" "}
            {club._count.members === 1 ? "member" : "members"}
          </p>
        </div>
      </header>

      {club.description ? (
        <p className="mt-4 leading-relaxed text-ink-soft">{club.description}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ClubMembership slug={club.slug} role={role} signedIn={!!user} />
        {manages ? (
          <div className="flex gap-2">
            <ButtonLink href={`/c/${club.slug}/members`} variant="secondary" size="sm">
              Members
            </ButtonLink>
            <ButtonLink href={`/events/new?club=${club.id}`} size="sm">
              Post a night
            </ButtonLink>
          </div>
        ) : null}
      </div>

      <section className="mt-8">
        <SectionHeading
          title="Coming up"
          hint={
            upcoming.length === 0
              ? undefined
              : `${upcoming.length} ${upcoming.length === 1 ? "night" : "nights"}`
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            body={
              manages
                ? "Post the club's first night and it'll show up here for everyone."
                : "Join and you'll see nights here as soon as they're posted."
            }
            action={
              manages ? (
                <ButtonLink href={`/events/new?club=${club.id}`}>Post a night</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((night) => (
              <li key={night.id}>
                <EventCard
                  href={`/e/${night.id}`}
                  event={{
                    id: night.id,
                    title: night.title,
                    city: night.city,
                    date: night.date,
                    durationHours: night.durationHours,
                    going: night._count.guests,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-8">
          <SectionHeading title={`Past (${past.length})`} />
          <ul className="space-y-2.5 opacity-70">
            {past.slice(0, 10).map((night) => (
              <li key={night.id}>
                <EventCard
                  href={`/e/${night.id}`}
                  event={{
                    id: night.id,
                    title: night.title,
                    city: night.city,
                    date: night.date,
                    durationHours: night.durationHours,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!user ? (
        <p className="mt-8 text-center text-sm text-ink-mute">
          <Link href="/signup" className="font-medium text-clay hover:underline">
            Create an account
          </Link>{" "}
          to join clubs and post your own nights.
        </p>
      ) : null}
    </div>
  );
}
