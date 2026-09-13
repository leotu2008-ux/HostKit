/**
 * Recurring listings folded into one row for the previews. Belong at
 * Babson lists every pickleball and badminton open play as its own event —
 * 119 of its 162 upcoming items — so a short "At Babson" list would be
 * nothing else. The full campus page still shows each date.
 */

export type Series = {
  /** How many dates the series has in the window. */
  count: number;
  /** "Mon & Wed · 5:00 PM · 12 dates" */
  label: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
}

/** Dates are wall-clock encoded as UTC, so UTC getters read the school's clock. */
export function seriesLabel(dates: Date[]): string {
  const days = [...new Set(dates.map((d) => d.getUTCDay()))]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAYS[d]);
  const clocks = new Set(dates.map((d) => `${d.getUTCHours()}:${d.getUTCMinutes()}`));
  const when = days.length <= 3 ? joinAnd(days) : "Most days";
  // Read in UTC: these are the school's wall-clock times encoded that way.
  const clock = clocks.size === 1 ? dates[0].toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) : null;
  return `${when}${clock ? ` · ${clock}` : ""} · ${dates.length} dates`;
}

function seriesKey(row: { title: string; host: string | null }): string {
  return `${row.title.toLowerCase().replace(/\s+/g, " ").trim()}|${(row.host ?? "").toLowerCase().trim()}`;
}

/**
 * One row per title-and-host, at its first date, in the order the first
 * dates come; `repeats` says how the rest fall when there are more.
 */
export function collapseSeries<T extends { title: string; host: string | null; startsAt: Date }>(
  rows: T[],
): (T & { repeats: Series | null })[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = seriesKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((group) => ({
    ...group[0],
    repeats: group.length > 1 ? { count: group.length, label: seriesLabel(group.map((g) => g.startsAt)) } : null,
  }));
}
