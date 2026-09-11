import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";
import { requestOwnsDraft } from "@/lib/api/drafts";
import { registrationState } from "@/lib/registration";
import { attendeesPreview } from "@/lib/attendees";
import { apiError, apiUser, json } from "@/lib/api/http";
import { eventInclude, serializeEvent } from "@/lib/api/serialize";

/** One night: anyone can read a live public or unlisted night; the owner, or
 *  the device that drafted it, can also read drafts and private nights. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await apiUser(request);

  const event = await db.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  // Same answer for "doesn't exist" and "not yours to see", so ids of
  // private nights can't be confirmed.
  if (!event) return apiError("Not found.", 404);
  const canManage =
    (viewer !== null && event.ownerId === viewer.id) ||
    requestOwnsDraft(request, event);
  if (!canManage && !isPublicPageVisible(event)) {
    return apiError("Not found.", 404);
  }

  const [registration, preview] = await Promise.all([
    registrationState(event.id, viewer?.id ?? null),
    attendeesPreview(event.id),
  ]);
  return json({
    event: serializeEvent(event, event._count.guests, canManage, registration, preview.attendees),
  });
}
