import Link from "next/link";
import { db } from "@/lib/db";
import { requireClub } from "@/lib/session";
import { MemberRow } from "@/components/member-row";
import { Card } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/c/[slug]/members">) {
  const { slug } = await params;
  const club = await db.club.findUnique({ where: { slug }, select: { name: true } });
  return { title: club ? `${club.name} · Members` : "Members" };
}

export default async function ClubMembersPage({
  params,
}: PageProps<"/c/[slug]/members">) {
  const { slug } = await params;
  // Admins and owners only. Members and outsiders land back on the club page.
  const { user, club, role } = await requireClub(slug, "ADMIN");

  const members = await db.clubMember.findMany({
    where: { clubId: club.id },
    include: { user: { select: { name: true, email: true } } },
    // Owners first, then admins, then members; newest last within each.
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="px-4 py-6">
      <Link
        href={`/c/${club.slug}`}
        className="text-sm font-medium text-clay hover:underline"
      >
        ← {club.name}
      </Link>
      <h1 className="font-display mt-3 text-2xl text-ink">Members</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        {members.length} {members.length === 1 ? "person" : "people"}. Admins
        can post nights and manage members; only owners can make owners.
      </p>

      <Card className="divide-y divide-line">
        {members.map((m) => (
          <MemberRow
            key={m.userId}
            slug={club.slug}
            member={{
              userId: m.userId,
              name: m.user.name,
              email: m.user.email,
              role: m.role,
            }}
            actorRole={role}
            isSelf={m.userId === user.id}
          />
        ))}
      </Card>
    </div>
  );
}
