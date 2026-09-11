import { db } from "@/lib/db";
import { goingCount } from "@/lib/api/serialize";
import { upcomingOnly } from "@/lib/upcoming";

export type MineRole = "hosting" | "going";

/**
 * The nights that matter to one person right now: upcoming events they host
 * or have registered for (declined ones don't count), soonest first with
 * undated ones last. Both Discover pages lead with this.
 */
export async function myUpcomingEvents(userId: string, take = 12) {
  const rows = await db.event.findMany({
    where: {
      ...upcomingOnly(),
      OR: [
        { ownerId: userId },
        { guests: { some: { userId, rsvpStatus: { not: "DECLINED" } } } },
      ],
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    take,
    include: { owner: { select: { name: true } }, ...goingCount },
  });
  return rows.map((event) => ({
    ...event,
    role: (event.ownerId === userId ? "hosting" : "going") as MineRole,
  }));
}
