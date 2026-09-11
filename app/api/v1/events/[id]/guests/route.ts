import { db } from "@/lib/db";
import { apiError, apiUser, json, ownedEvent } from "@/lib/api/http";
import { serializeGuest } from "@/lib/api/serialize";

/** The guest list and door counts for a night the host owns. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const event = await ownedEvent(id, user.id);
  if (!event) return apiError("Not found.", 404);

  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ name: "asc" }],
  });

  return json({
    guests: guests.map(serializeGuest),
    summary: {
      capacity: event.guestCount,
      going: guests.filter((g) => g.rsvpStatus === "ATTENDING").length,
      checkedIn: guests.filter((g) => g.checkedInAt).length,
      invited: guests.filter((g) => g.rsvpStatus === "INVITED").length,
      declined: guests.filter((g) => g.rsvpStatus === "DECLINED").length,
    },
  });
}
