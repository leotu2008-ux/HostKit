import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { serializeGuest } from "@/lib/api/serialize";

const schema = z.object({ checkedIn: z.boolean() });

/** Checks a guest in at the door, or undoes it. Mirrors lib/actions/checkin. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { id, guestId } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say whether they're in.", 400);

  const guest = await db.guest.findFirst({
    where: { id: guestId, eventId: event.id },
  });
  if (!guest) return apiError("Not found.", 404);

  // The RSVP is the guest's, not the door's — see lib/actions/checkin.ts for
  // why overwriting it here quietly destroyed the attendance signal.
  const updated = await db.guest.update({
    where: { id: guest.id },
    data: parsed.data.checkedIn
      ? { checkedInAt: new Date(), arrivedWithoutRsvp: guest.rsvpStatus !== "ATTENDING" }
      : { checkedInAt: null, arrivedWithoutRsvp: false },
  });
  return json({ guest: serializeGuest(updated) });
}
