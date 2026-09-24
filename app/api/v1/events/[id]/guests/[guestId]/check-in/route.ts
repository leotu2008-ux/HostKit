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
  // Already in: answer with the first arrival rather than re-stamping it.
  if (parsed.data.checkedIn && guest.checkedInAt) return json({ guest: serializeGuest(guest) });

  if (!parsed.data.checkedIn) {
    const updated = await db.guest.update({
      where: { id: guest.id },
      data: { checkedInAt: null, arrivedWithoutRsvp: false },
    });
    return json({ guest: serializeGuest(updated) });
  }

  // The RSVP is the guest's, not the door's — see lib/actions/checkin.ts for
  // why overwriting it here quietly destroyed the attendance signal. Only
  // while they're still not in, so a second device tapping at the same
  // moment gets the first arrival back instead of re-stamping it.
  await db.guest.updateMany({
    where: { id: guest.id, checkedInAt: null },
    data: { checkedInAt: new Date(), arrivedWithoutRsvp: guest.rsvpStatus !== "ATTENDING" },
  });
  const admitted = await db.guest.findUnique({ where: { id: guest.id } });
  if (!admitted) return apiError("Not found.", 404);
  return json({ guest: serializeGuest(admitted) });
}
