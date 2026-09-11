import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";
import { apiError, apiUser, json } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";

/** One night: anyone can read a live public or unlisted night; the owner can
 *  also read drafts and private nights. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await apiUser(request);

  const event = await db.event.findUnique({
    where: { id },
    include: { owner: { select: { name: true } }, ...goingCount },
  });
  // Same answer for "doesn't exist" and "not yours to see", so ids of
  // private nights can't be confirmed.
  if (!event) return apiError("Not found.", 404);
  const isOwner = viewer !== null && event.ownerId === viewer.id;
  if (!isOwner && !isPublicPageVisible(event)) {
    return apiError("Not found.", 404);
  }

  return json({
    event: serializeEvent(event, event._count.guests, viewer?.id ?? null),
  });
}
