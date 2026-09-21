/** Night-of and card dates, always the same phrasing across Discover and /e. */

const DATE: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

const DATE_LONG: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
};

export function formatEventDate(date: Date | null, long = false): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-US", long ? DATE_LONG : DATE);
}

export function formatEventTime(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventWhen(
  date: Date | null,
  durationHours: number,
): string {
  const day = formatEventDate(date);
  if (!day) return `${durationHours}h · date TBD`;
  const time = formatEventTime(date);
  const hasClock =
    date != null && (date.getHours() !== 12 || date.getMinutes() !== 0);
  if (hasClock && time) return `${day} · ${time} · ${durationHours}h`;
  return `${day} · ${durationHours}h`;
}

/** Combines a `yyyy-mm-dd` date and an optional `HH:MM` time into one Date,
 *  the way the intake form and the brief action both submit it. Null when
 *  there's no date, or the pair doesn't parse. */
export function parseStart(date: string, time: string): Date | null {
  if (!date) return null;
  const clock = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  const parsedDate = new Date(`${date}T${clock}:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}
