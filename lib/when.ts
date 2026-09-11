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
