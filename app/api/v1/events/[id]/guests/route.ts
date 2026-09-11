import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent } from "@/lib/api/http";
import { guestPhone, serializeGuest } from "@/lib/api/serialize";

/** The guest list and door counts for a night this request manages. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ name: "asc" }],
    include: guestPhone,
  });

  return json({
    guests: guests.map(serializeGuest),
    summary: {
      capacity: event.guestCount,
      going: guests.filter((g) => g.rsvpStatus === "ATTENDING").length,
      checkedIn: guests.filter((g) => g.checkedInAt).length,
      invited: guests.filter((g) => g.rsvpStatus === "INVITED").length,
      declined: guests.filter((g) => g.rsvpStatus === "DECLINED").length,
      pending: guests.filter((g) => g.rsvpStatus === "PENDING").length,
      waitlisted: guests.filter((g) => g.rsvpStatus === "WAITLISTED").length,
    },
  });
}
