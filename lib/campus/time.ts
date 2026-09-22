/**
 * Time helpers for campus feeds. Hosty stores every event start as the
 * host's wall-clock time encoded as UTC (see Event.date), so feeds — which
 * speak real instants, or local times in the school's zone — are converted
 * to that convention here.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading of `instant` in `timeZone`, encoded as UTC. */
export function wallClock(instant: Date, timeZone: string): Date {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")),
  );
}

/** Builds a wall-clock date (encoded as UTC) from local components. */
export function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/**
 * Parses an iCalendar date-time. `20260911T090000` is a local (floating or
 * TZID) time and is taken as the school's wall clock; `20260911T130000Z` is an
 * instant and is converted into it; `20260911` is an all-day date.
 */
export function parseIcsDate(
  value: string,
  timeZone: string,
): { date: Date; allDay: boolean } | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { date: localDate(+y, +mo, +d), allDay: true };
  if (z) {
    const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? "0")));
    return { date: wallClock(instant, timeZone), allDay: false };
  }
  return { date: localDate(+y, +mo, +d, +h, +mi, +(s ?? "0")), allDay: false };
}

/** ISO 8601 with an offset (or Z) → the school's wall clock. */
export function parseOffsetIso(value: string, timeZone: string): Date | null {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  // A bare date or a naive time has no offset: it's already local.
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return localDate(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  return wallClock(instant, timeZone);
}

/** "5:30 PM" / "8 pm" → hours and minutes; null for anything else. */
export function parseClock(text: string): { h: number; mi: number } | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?$/i);
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3].toUpperCase() === "P") h += 12;
  return { h, mi: +(m[2] ?? "0") };
}

/** Wall-clock hours between two encoded dates, at least 1, at most 24. */
export function durationHours(start: Date, end: Date | null): number {
  if (!end) return 2;
  const hours = Math.round((end.getTime() - start.getTime()) / 3_600_000);
  return Math.min(24, Math.max(1, hours || 1));
}
