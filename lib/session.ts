import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claimMatches, readDraftClaims } from "@/lib/drafts";
import { canManageClub, hasRole } from "@/lib/clubs";
import type { ClubRole } from "@/generated/prisma/enums";

/** The signed-in user, or null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}

/** The signed-in user, or a redirect to sign-in. Use in any protected page. */
export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const dest = next
      ? `/signin?next=${encodeURIComponent(next)}`
      : "/signin";
    redirect(dest);
  }
  return user;
}

/** The caller's role in a club, or null when signed out or not a member. */
export async function clubRoleFor(
  clubId: string,
  userId: string | null,
): Promise<ClubRole | null> {
  if (!userId) return null;
  const member = await db.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function canAccessEvent(
  event: {
    id: string;
    ownerId: string | null;
    claimToken: string | null;
    clubId?: string | null;
  },
  userId: string | null,
) {
  if (userId && event.ownerId === userId) return true;
  // A night posted as a club is run by everyone who runs the club, not just
  // whoever happened to click "create".
  if (userId && event.clubId) {
    if (canManageClub(await clubRoleFor(event.clubId, userId))) return true;
  }
  const claims = await readDraftClaims();
  if (claimMatches(claims, event.id, event.claimToken)) return true;
  return false;
}

/**
 * Loads an event the current user owns, or a draft this browser claimed.
 *
 * Returning the event list for someone else's event avoids confirming that
 * an id exists. Signed-out drafts stay on the cookie until they sign in.
 */
export async function requireEvent(eventId: string) {
  const user = await getCurrentUser();
  const event = await db.event.findFirst({ where: { id: eventId } });
  if (!event) redirect("/events");

  const allowed = await canAccessEvent(event, user?.id ?? null);
  if (!allowed) {
    if (!user) redirect(`/signin?next=${encodeURIComponent(`/events/${eventId}`)}`);
    redirect("/events");
  }
  return { user, event };
}

/** Ids of every club the user can post nights as (owner or admin). */
export async function managedClubIds(userId: string): Promise<string[]> {
  const rows = await db.clubMember.findMany({
    where: { userId, role: { in: ["OWNER", "ADMIN"] } },
    select: { clubId: true },
  });
  return rows.map((r) => r.clubId);
}

/**
 * Loads a club the current user holds at least `min` role in, or redirects.
 *
 * Management pages use this with "ADMIN". Like requireEvent it redirects
 * rather than 404s — to the public club page for members without the role,
 * and home for a slug that doesn't exist, so it never confirms one does.
 */
export async function requireClub(slug: string, min: ClubRole = "MEMBER") {
  const user = await requireUser(`/c/${slug}`);
  const club = await db.club.findUnique({ where: { slug } });
  if (!club) redirect("/");

  const role = await clubRoleFor(club.id, user.id);
  if (!hasRole(role, min)) redirect(`/c/${slug}`);

  return { user, club, role: role as ClubRole };
}
