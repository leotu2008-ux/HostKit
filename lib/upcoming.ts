import { startOfDay } from "@/lib/plan";

/**
 * Prisma filter for nights that haven't happened yet: anything from the start
 * of today onwards, plus nights still waiting on a date. Discover and the iOS
 * feed share it so neither lists last month's parties.
 */
export function upcomingOnly(now = new Date()) {
  return {
    OR: [{ date: null }, { date: { gte: startOfDay(now) } }],
  };
}

/** The opposite of upcomingOnly: dated nights before today. */
export function pastOnly(now = new Date()) {
  return { date: { lt: startOfDay(now) } };
}
