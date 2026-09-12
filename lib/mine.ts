import { db } from "@/lib/db";
import { eventInclude } from "@/lib/api/serialize";
import { managedClubIds } from "@/lib/clubs";
import { stateOf } from "@/lib/registration";
import { upcomingOnly } from "@/lib/upcoming";
import type { MineRole } from "@/lib/mine-format";

export { mineRoleLabel, type MineRole } from "@/lib/mine-format";

/**
 * The nights that matter to one person right now: upcoming events they host
 * (their own, or posted as a club they run), are going to, have asked to
 * join, or are waiting on — soonest first with undated ones last. Both Home
 * pages lead with this.
 */
export async function myUpcomingEvents(userId: string, take = 12) {
  const clubIds = await managedClubIds(userId);
  const rows = await db.event.findMany({
    where: {
      ...upcomingOnly(),
      OR: [
        { ownerId: userId },
        ...(clubIds.length > 0 ? [{ clubId: { in: clubIds } }] : []),
        { guests: { some: { userId, rsvpStatus: { in: ["ATTENDING", "PENDING", "WAITLISTED"] } } } },
      ],
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      ...eventInclude,
      guests: { where: { userId }, select: { rsvpStatus: true }, take: 1 },
    },
  });
  return rows.map(({ guests, ...event }) => {
    const hosting =
      event.ownerId === userId || (event.clubId !== null && clubIds.includes(event.clubId));
    const state = stateOf(guests[0]?.rsvpStatus);
    const role: MineRole = hosting ? "hosting" : state === "none" ? "going" : state;
    return { ...event, role };
  });
}
