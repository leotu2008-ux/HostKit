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

/** `durationHours` is fractional (quarter hours from the duration wheel), so
 *  no caller may interpolate it raw: "1.5h" is not how anyone says an hour and
 *  a half. Minutes are the smallest unit the wheel can set, so rounding to
 *  the nearest one also launders float noise — 3.999 stored is "4h" shown. */
function splitDuration(hours: number): { hours: number; minutes: number } {
  const total = Number.isFinite(hours) ? Math.round(hours * 60) : 0;
  if (total <= 0) return { hours: 0, minutes: 0 };
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** The compact form, for tiles and cards: "15m", "4h", "1h 30m". */
export function formatDuration(durationHours: number): string {
  const { hours, minutes } = splitDuration(durationHours);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** The spelled-out form, for prose and outreach: "45 minutes", "4 hours",
 *  "1 hour 30 minutes". */
export function formatDurationLong(durationHours: number): string {
  const { hours, minutes } = splitDuration(durationHours);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (hours === 0) return unit(minutes, "minute");
  if (minutes === 0) return unit(hours, "hour");
  return `${unit(hours, "hour")} ${unit(minutes, "minute")}`;
}

export function formatEventWhen(
  date: Date | null,
  durationHours: number,
): string {
  const length = formatDuration(durationHours);
  const day = formatEventDate(date);
  if (!day) return `${length} · date TBD`;
  const time = formatEventTime(date);
  const hasClock =
    date != null && (date.getHours() !== 12 || date.getMinutes() !== 0);
  if (hasClock && time) return `${day} · ${time} · ${length}`;
  return `${day} · ${length}`;
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

/** The inverse of `parseStart`: the `yyyy-mm-dd`/`HH:MM` strings an
 *  `input[type=date]`/`input[type=time]` pair need to show a saved start
 *  back to the host who set it. Both empty when there's no date yet. */
export function splitStart(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}
