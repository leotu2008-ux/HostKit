import Link from "next/link";
import { EventCover } from "@/components/event-cover";
import { formatEventWhen } from "@/lib/when";
import type { MineRole } from "@/lib/mine";

/** A compact card for the "Your events" strip: cover on top, title, when, your role. */
export function EventTile({
  event,
}: {
  event: {
    id: string;
    title: string;
    date: Date | null;
    durationHours: number;
    published: boolean;
    coverUrl?: string | null;
    role: MineRole;
  };
}) {
  const hosting = event.role === "hosting";
  return (
    <Link
      href={hosting ? `/events/${event.id}` : `/e/${event.id}`}
      className="group block w-[220px] shrink-0 snap-start overflow-hidden rounded-card border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
    >
      <div className="aspect-[16/10] w-full bg-sunk">
        <EventCover id={event.id} title={event.title} coverUrl={event.coverUrl} sizes="440px" />
      </div>
      <div className="p-3">
        <p className="truncate text-[12px] text-ink-mute">
          {formatEventWhen(event.date, event.durationHours)}
        </p>
        <p className="font-event mt-0.5 line-clamp-2 text-[16px] leading-snug text-ink">
          {event.title}
        </p>
        <span
          className={
            hosting
              ? "mt-2 inline-block rounded-full bg-clay-wash px-2 py-0.5 text-[11px] font-medium text-clay-deep"
              : "mt-2 inline-block rounded-full bg-forest-wash px-2 py-0.5 text-[11px] font-medium text-forest"
          }
        >
          {hosting ? (event.published ? "Hosting" : "Draft") : "Going"}
        </span>
      </div>
    </Link>
  );
}
