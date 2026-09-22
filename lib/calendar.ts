/**
 * Calendar files and links for an event. Starts are stored as the host's
 * wall-clock time encoded as UTC, so both outputs use *floating* local time
 * (no zone): 7:30 PM stays 7:30 PM in whichever calendar it lands in.
 */

export type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  durationHours: number;
  city: string;
  address: string | null;
  description: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYYMMDDTHHMMSS from the UTC fields — the wall-clock the host typed. */
export function floating(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
  );
}

export function endOf(event: Pick<CalendarEvent, "date" | "durationHours">): Date {
  return new Date(event.date.getTime() + event.durationHours * 60 * 60 * 1000);
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are limited to 75 octets; fold with CRLF + space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

// A blank/half-brief event can have neither an address nor a city yet;
// null (rather than an empty string) means "leave the location out entirely".
function placeFor(event: Pick<CalendarEvent, "address" | "city">): string | null {
  return event.address || event.city || null;
}

export function icsFor(event: CalendarEvent, url: string, now = new Date()): string {
  const place = placeFor(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hosty//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@hostkit`,
    `DTSTAMP:${floating(now)}Z`,
    `DTSTART:${floating(event.date)}`,
    `DTEND:${floating(endOf(event))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(place ? [`LOCATION:${escapeIcs(place)}`] : []),
    `DESCRIPTION:${escapeIcs([event.description ?? "", url].filter(Boolean).join("\n\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(event: CalendarEvent, url: string): string {
  const place = placeFor(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${floating(event.date)}/${floating(endOf(event))}`,
    ...(place ? { location: place } : {}),
    details: [event.description ?? "", url].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
