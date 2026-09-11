import { db } from "@/lib/db";
import { eventInclude } from "@/lib/api/serialize";
import { notify } from "@/lib/notify";
import { formatEventWhen } from "@/lib/when";

/**
 * The one place an event goes live (or back to draft), shared by the web
 * action, the API and anything else that flips `published`. A draft made
 * before signing in is claimed by the publishing host here. Anything that
 * should happen when a night first goes live — telling a club's followers,
 * later — hangs off `justPublished`.
 */
export async function publishEvent(input: {
  eventId: string;
  user: { id: string; schoolDomain: string | null };
  published: boolean;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  requiresApproval?: boolean;
}) {
  const before = await db.event.findUniqueOrThrow({
    where: { id: input.eventId },
    select: { ownerId: true, published: true },
  });
  const event = await db.event.update({
    where: { id: input.eventId },
    data: {
      published: input.published,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.requiresApproval === undefined ? {} : { requiresApproval: input.requiresApproval }),
      ...(before.ownerId === null ? { ownerId: input.user.id, schoolDomain: input.user.schoolDomain } : {}),
    },
    include: eventInclude,
  });
  const justPublished = input.published && !before.published;
  if (justPublished) await afterPublish(event.id);
  return { event, justPublished };
}

/** A first publish of a club event tells the club's followers. */
export async function afterPublish(eventId: string): Promise<void> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      durationHours: true,
      city: true,
      visibility: true,
      ownerId: true,
      club: { select: { id: true, name: true, followers: { select: { userId: true } } } },
    },
  });
  if (!event?.club || event.visibility === "PRIVATE") return;
  const followers = event.club.followers.map((f) => f.userId).filter((id) => id !== event.ownerId);
  await notify(followers, {
    kind: "club_published",
    title: `${event.club.name} posted ${event.title}`,
    body: `${formatEventWhen(event.date, event.durationHours)} · ${event.city.split(",")[0]}`,
    eventId: event.id,
    clubId: event.club.id,
  });
}
