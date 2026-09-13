import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claimMatches, readDraftClaims } from "@/lib/drafts";
import { schoolFor } from "@/lib/schools";

/** The signed-in user, or null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  // A password reset bumps the account's version; cookies from before it are out.
  const row = await db.user.findUnique({ where: { id: session.user.id }, select: { sessionVersion: true } });
  if (!row || row.sessionVersion !== (session.user.sessionVersion ?? 0)) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}

/**
 * The signed-in user's full profile row — school, class year, bio — or null.
 * The session token only carries id/name/email, so anything that needs the
 * student side reads the database.
 */
export async function currentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      schoolDomain: true,
      classYear: true,
      bio: true,
      company: true,
      xHandle: true,
      linkedinHandle: true,
      instagramHandle: true,
      imageUrl: true,
      phone: true,
      phoneVerifiedAt: true,
      showOnGuestLists: true,
      emailVerifiedAt: true,
    },
  });
  if (!row) return null;
  return { ...row, school: schoolFor(row.schoolDomain) };
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

export async function canAccessEvent(
  event: { id: string; ownerId: string | null; claimToken: string | null; clubId?: string | null },
  userId: string | null,
) {
  if (userId && event.ownerId === userId) return true;
  const claims = await readDraftClaims();
  if (claimMatches(claims, event.id, event.claimToken)) return true;
  // Admins of the club an event was posted as run it too.
  if (userId && event.clubId) {
    const member = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: event.clubId, userId } },
      select: { role: true },
    });
    if (member) return true;
  }
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
