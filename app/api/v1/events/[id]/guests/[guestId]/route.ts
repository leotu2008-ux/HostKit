import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { guestPhone, serializeGuest } from "@/lib/api/serialize";
import { decideRequest, promoteWaitlist, releasesSeat } from "@/lib/waitlist";

const schema = z.object({ status: z.enum(["ATTENDING", "DECLINED"]) });

/**
 * The host decides for one guest: approve or decline a request, or change
 * a reply. Any change that frees a seat lets the waitlist move.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { id, guestId } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say ATTENDING or DECLINED.", 400);

  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) return apiError("Not found.", 404);

  if (guest.rsvpStatus === "PENDING" || guest.rsvpStatus === "WAITLISTED") {
    await decideRequest(event.id, guest.id, parsed.data.status === "ATTENDING");
  } else {
    await db.guest.update({
      where: { id: guest.id },
      data: { rsvpStatus: parsed.data.status, respondedAt: new Date() },
    });
  }
  if (releasesSeat(guest.rsvpStatus, parsed.data.status)) await promoteWaitlist(event.id);

  const updated = await db.guest.findUniqueOrThrow({ where: { id: guest.id }, include: guestPhone });
  return json({ guest: serializeGuest(updated) });
}
