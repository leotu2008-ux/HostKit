import { db } from "@/lib/db";
import { daysUntil } from "@/lib/plan";
import { effectiveHeadcount, summarizeGuests } from "@/lib/guests";
import type { ScorableEvent } from "@/lib/scoring";

/**
 * The numbers every listing is scored against.
 *
 * Centralised so discovery, the shortlist and a listing page can never
 * disagree about how many guests are coming — which they would, quietly, if
 * each reached for event.guestCount directly and only one of them accounted
 * for RSVPs.
 */
export async function planningContext(event: {
  id: string;
  guestCount: number;
  durationHours: number;
  date: Date | null;
}): Promise<ScorableEvent & { headSource: "planned" | "rsvp" }> {
  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    select: { rsvpStatus: true, plusOnes: true },
  });

  const head = effectiveHeadcount(event.guestCount, summarizeGuests(guests));

  return {
    guestCount: head.count,
    durationHours: event.durationHours,
    daysUntil: daysUntil(event.date),
    headSource: head.source,
  };
}
