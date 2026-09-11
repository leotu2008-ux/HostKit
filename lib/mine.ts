import { db } from "@/lib/db";
import { eventInclude } from "@/lib/api/serialize";
import { stateOf } from "@/lib/registration";
import { upcomingOnly } from "@/lib/upcoming";

export type MineRole = "hosting" | "going" | "pending" | "waitlisted";

/**
 * The nights that matter to one person right now: upcoming events they host,
 * are going to, have asked to join, or are waiting on — soonest first with
 * undated ones last. Both Home pages lead with this.
 */
export async function myUpcomingEvents(userId: string, take = 12) {
  const rows = await db.event.findMany({
    where: {
      ...upcomingOnly(),
      OR: [
        { ownerId: userId },
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
    const state = stateOf(guests[0]?.rsvpStatus);
    const role: MineRole =
      event.ownerId === userId ? "hosting" : state === "none" ? "going" : state;
    return { ...event, role };
  });
}
