import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { formatEventWhen } from "@/lib/when";
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
};

/**
 * One night in a list: when, the title, who and where, with the cover as a
 * thumbnail on the right. The same row works in Discover and in a host's
 * timeline.
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
          {formatEventWhen(event.date, event.durationHours)}
        </p>
        <p className="font-event mt-0.5 truncate text-[19px] leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-1 truncate text-[13px] text-ink-soft">
          {event.hostName ? `By ${event.hostName} · ` : ""}
          {event.city}
        </p>
        {typeof event.going === "number" || event.status ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        <CoverArt id={event.id} title={event.title} />
      </div>
    </Link>
  );
}
