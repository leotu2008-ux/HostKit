import { EventNav } from "@/components/event-nav";
import { requireEvent } from "@/lib/session";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { Badge } from "@/components/ui";

export async function generateMetadata({ params }: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  return { title: event.title };
}

export default async function EventLayout({
  children,
  params,
}: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  const days = daysUntil(event.date);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-3xl text-ink">{event.title}</h1>
          <Badge tone={days !== null && days <= 14 ? "amber" : "neutral"}>
            {describeCountdown(days)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {EVENT_TYPE_LABEL[event.type]} · {event.city} · {event.guestCount}{" "}
          guests · {event.durationHours} hours
        </p>
      </header>

      <div className="mb-8 border-b border-line">
        <EventNav eventId={event.id} />
      </div>

      {children}
    </div>
  );
}
