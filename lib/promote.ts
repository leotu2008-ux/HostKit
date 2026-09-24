import { formatEventDate, formatEventTime, hasClock } from "@/lib/when";

/** The public link for a night on a given site origin. */
export function eventUrl(origin: string, eventId: string): string {
  return `${origin.replace(/\/$/, "")}/e/${eventId}`;
}

/** Ready-to-paste copy for a story, a group chat, or a poster. */
export function promoBlurb(event: {
  title: string;
  date: Date | null;
  city: string;
  address: string | null;
  ticketType: "FREE" | "PAID";
  description: string | null;
}, link: string): string {
  // A night saved without a start time shows its day alone, as on /e.
  const when = !event.date
    ? "Date to be announced"
    : hasClock(event.date)
      ? `${formatEventDate(event.date)} · ${formatEventTime(event.date)}`
      : formatEventDate(event.date)!;
  // A blank/half-brief event has neither yet; drop the location clause
  // entirely rather than printing a trailing " · ".
  const where = event.address || event.city || null;
  const lines = [
    event.title,
    where ? `${when} · ${where}` : when,
    event.description ? "" : null,
    event.description ? event.description.split("\n")[0] : null,
    "",
    `${event.ticketType === "FREE" ? "Free" : "Tickets"} · register: ${link}`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
