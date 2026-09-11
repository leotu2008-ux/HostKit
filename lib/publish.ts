import { db } from "@/lib/db";
import { eventInclude } from "@/lib/api/serialize";

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

/** What a first publish sets in motion — telling a club's followers, once
 *  notifications exist. */
export async function afterPublish(eventId: string): Promise<void> {
  void eventId;
}
