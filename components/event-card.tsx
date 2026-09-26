import Link from "next/link";
import { EventCover } from "@/components/event-cover";
import { formatEventDate, formatEventTime, formatEventWhen } from "@/lib/when";
import { schoolFor } from "@/lib/schools";
import { cx } from "@/components/ui";

export type EventCardEvent = {
  id: string;
  title: string;
  city: string;
  date: Date | null;
  durationHours: number;
  going?: number;
  hostName?: string;
  /** Short state label for the host's own list ("Draft", "Public"…). */
  status?: string;
  /** The host's school, shown as a chip. */
  schoolDomain?: string | null;
  /** An uploaded cover photo; otherwise the cover is drawn from the id. */
  coverUrl?: string | null;
  /** Official calendar events: all-day, and the end is only known when the feed said. */
  allDay?: boolean;
  /** When known; official events without one show no duration at all. */
  endsAt?: Date | null;
  official?: boolean;
  /** A recurring listing folded to one row: "Mon & Wed · 5:00 PM · 12 dates". */
  repeats?: string | null;
};

/** "Fri, Sep 18 · 7:30 PM · 4h", "Fri, Sep 18 · All day", or — for an
 *  official event with no end — just the start. */
export function whenLabel(event: EventCardEvent): string {
  if (event.official) {
    const day = formatEventDate(event.date);
    if (!day) return "Date to be announced";
    if (event.allDay) return `${day} · All day`;
    const time = formatEventTime(event.date);
    if (!event.endsAt) return `${day} · ${time}`;
    return `${day} · ${time} – ${formatEventTime(event.endsAt)}`;
  }
  return formatEventWhen(event.date, event.durationHours);
}

/**
 * One night in a list: when, the title, who and where, with the cover as a
 * thumbnail on the right, as in a host's list of their events.
 */
export function EventCard({
  event,
  href,
  className,
}: {
  event: EventCardEvent;
  href: string;
  className?: string;
}) {
  const school = schoolFor(event.schoolDomain);
  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-4 rounded-card border border-line bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink-mute">
          {whenLabel(event)}
        </p>
        <p className="font-event mt-0.5 truncate text-[19px] leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-1 truncate text-[13px] text-ink-soft">
          {event.hostName ? `By ${event.hostName} · ` : ""}
          {event.city}
        </p>
        {event.repeats ? (
          <p className="mt-0.5 truncate text-[12px] text-ink-mute">Repeats · {event.repeats}</p>
        ) : null}
        {typeof event.going === "number" || event.status || school ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {school ? (
              <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand">
                {school.short}
              </span>
            ) : null}
            {event.status ? (
              <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                {event.status}
              </span>
            ) : null}
            {typeof event.going === "number" ? (
              <span className="rounded-full bg-forest-wash px-2 py-0.5 text-[11px] font-medium text-forest">
                {event.going} going
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-sunk">
        <EventCover
          id={event.id}
          title={event.title}
          coverUrl={event.coverUrl}
          host={event.hostName}
          sizes="168px"
        />
      </div>
    </Link>
  );
}
