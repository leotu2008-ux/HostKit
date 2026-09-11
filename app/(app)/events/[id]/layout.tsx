import Link from "next/link";
import { EventNav } from "@/components/event-nav";
import { requireEvent } from "@/lib/session";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { Badge } from "@/components/ui";
import { CoverArt } from "@/components/cover-art";
import {
  publishEventAction,
  unpublishEventAction,
} from "@/lib/actions/events";

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
  const { event, user } = await requireEvent(id);
  const days = daysUntil(event.date);

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-card bg-sunk">
          <CoverArt id={event.id} title={event.title} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl leading-tight text-ink">
              {event.title}
            </h1>
            <Badge tone={days !== null && days <= 14 ? "amber" : "neutral"}>
              {describeCountdown(days)}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            {EVENT_TYPE_LABEL[event.type]} · {event.city}
            {" · "}
            {event.published ? VISIBILITY_LABEL[event.visibility] : "Draft"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {event.visibility !== "PRIVATE" || event.published ? (
              <Link
                href={`/e/${event.id}`}
                className="text-[13px] font-medium text-clay"
              >
                Preview
              </Link>
            ) : (
              <Link
                href={`/e/${event.id}`}
                className="text-[13px] font-medium text-clay"
              >
                Preview
              </Link>
            )}
            {event.published ? (
              <form action={unpublishEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button
                  type="submit"
                  className="min-h-11 text-[13px] font-medium text-ink-soft"
                >
                  Unpublish
                </button>
              </form>
            ) : user ? (
              <form action={publishEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button
                  type="submit"
                  className="min-h-11 text-[13px] font-medium text-clay"
                >
                  Publish
                </button>
              </form>
            ) : (
              <Link
                href={`/signin?next=${encodeURIComponent(`/events/${event.id}`)}&publish=1`}
                className="min-h-11 text-[13px] font-medium text-clay"
              >
                Sign in to publish
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mb-5">
        <EventNav eventId={event.id} />
      </div>

      {children}
    </div>
  );
}
