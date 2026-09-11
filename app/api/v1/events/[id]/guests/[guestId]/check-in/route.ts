import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, ownedEvent, readJson } from "@/lib/api/http";
import { serializeGuest } from "@/lib/api/serialize";

const schema = z.object({ checkedIn: z.boolean() });

/** Checks a guest in at the door, or undoes it. Mirrors lib/actions/checkin. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { id, guestId } = await params;
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const event = await ownedEvent(id, user.id);
  if (!event) return apiError("Not found.", 404);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say whether they're in.", 400);

  const guest = await db.guest.findFirst({
    where: { id: guestId, eventId: event.id },
  });
  if (!guest) return apiError("Not found.", 404);

  const updated = await db.guest.update({
    where: { id: guest.id },
    data: parsed.data.checkedIn
      ? { checkedInAt: new Date(), rsvpStatus: "ATTENDING" }
      : { checkedInAt: null },
  });
  return json({ guest: serializeGuest(updated) });
}
