import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { formatEventWhen } from "@/lib/when";

export type EventCardEvent = {
  id: string;
  title: string;
  city: string;
  date: Date | null;
  durationHours: number;
  going?: number;
  hostName?: string;
};

export function EventCard({
  event,
  href,
}: {
  event: EventCardEvent;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-stretch gap-3 overflow-hidden rounded-card border border-line bg-surface active:bg-sunk"
    >
      <div className="h-[88px] w-[88px] shrink-0 overflow-hidden bg-sunk">
        <CoverArt id={event.id} title={event.title} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3">
        <p className="font-display truncate text-[17px] leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-ink-soft">
          {formatEventWhen(event.date, event.durationHours)}
        </p>
        <p className="truncate text-[13px] text-ink-mute">
          {event.city}
          {event.hostName ? ` · ${event.hostName}` : ""}
          {typeof event.going === "number" ? ` · ${event.going} going` : ""}
        </p>
      </div>
    </Link>
  );
}
