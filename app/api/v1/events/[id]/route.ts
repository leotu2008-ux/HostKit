import { db } from "@/lib/db";
import { isPublicPageVisible } from "@/lib/listing";
import { requestOwnsDraft } from "@/lib/api/drafts";
import { registrationState } from "@/lib/registration";
import { attendeesPreview } from "@/lib/attendees";
import { apiError, apiUser, isClubMember, json } from "@/lib/api/http";
import { eventInclude, serializeEvent } from "@/lib/api/serialize";
import { campusEventById, isCampusId, serializeCampusEvent } from "@/lib/campus/feed";

/** One night: anyone can read a live public or unlisted night; the owner, the
 *  admins of the club it's posted as, or the device that drafted it, can also
 *  read drafts and private nights. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // An official campus event: public, nothing to manage or register for.
  if (isCampusId(id)) {
    const row = await campusEventById(id);
    return row ? json({ event: serializeCampusEvent(row) }) : apiError("Not found.", 404);
  }
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
    requestOwnsDraft(request, event) ||
    (viewer !== null && event.clubId !== null && (await isClubMember(viewer.id, event.clubId)));
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
