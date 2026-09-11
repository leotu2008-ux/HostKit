import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** The signed-in user, or null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}

/** The signed-in user, or a redirect to sign-in. Use in any protected page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

/**
 * Loads an event the current user owns, or redirects.
 *
 * Every event-scoped page and action goes through this rather than a bare
 * findUnique, so ownership is enforced in one place. Returning 404-style
 * behaviour (redirect to the event list) for someone else's event also avoids
 * confirming that an id exists.
 */
export async function requireEvent(eventId: string) {
  const user = await requireUser();
  const event = await db.event.findFirst({
    where: { id: eventId, ownerId: user.id },
  });
  if (!event) redirect("/events");
  return { user, event };
}
