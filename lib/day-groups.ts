import { daysUntil, describeCountdown } from "@/lib/plan";
import { formatEventDate } from "@/lib/when";

export type DayGroup<T> = {
  key: string;
  /** "Fri, Sep 18", or "Date to be announced". */
  label: string;
  /** "Today" / "Tomorrow" / "Yesterday" when it's that close, else null. */
  relative: string | null;
  items: T[];
};

/** Buckets a date-sorted list into calendar days, keeping the input order. */
export function groupByDay<T extends { date: Date | null }>(
  events: T[],
  now = new Date(),
): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const event of events) {
    const key = event.date ? event.date.toDateString() : "tba";
    let group = groups.get(key);
    if (!group) {
      const days = daysUntil(event.date, now);
      group = {
        key,
        label: formatEventDate(event.date) ?? "Date to be announced",
        relative:
          days !== null && Math.abs(days) <= 1 ? describeCountdown(days) : null,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(event);
  }
  return [...groups.values()];
}
