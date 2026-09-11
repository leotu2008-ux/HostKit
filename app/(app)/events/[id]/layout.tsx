import { EventNav } from "@/components/event-nav";
import { requireEvent } from "@/lib/session";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { Badge, Button, ButtonLink } from "@/components/ui";
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
    <div className="px-4 py-4 md:py-2">
      <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sunk md:h-20 md:w-20">
            <CoverArt id={event.id} title={event.title} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-mute">
              <span>
                {EVENT_TYPE_LABEL[event.type]} · {event.city}
              </span>
              <Badge tone={days !== null && days >= 0 && days <= 14 ? "amber" : "neutral"}>
                {describeCountdown(days)}
              </Badge>
            </div>
            <h1 className="font-event mt-0.5 truncate text-[24px] leading-tight text-ink md:text-[32px]">
              {event.title}
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {event.published
                ? VISIBILITY_LABEL[event.visibility]
                : "Draft — guests can’t see it yet"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={`/e/${event.id}`} variant="secondary" size="sm">
            Event page ↗
          </ButtonLink>
          {event.published ? (
            <form action={unpublishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <Button type="submit" variant="ghost" size="sm">
                Unpublish
              </Button>
            </form>
          ) : user ? (
            <form action={publishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <Button type="submit" size="sm">
                Publish
              </Button>
            </form>
          ) : (
            <ButtonLink
              href={`/signin?next=${encodeURIComponent(`/events/${event.id}`)}&publish=1`}
              size="sm"
            >
              Sign in to publish
            </ButtonLink>
          )}
        </div>
      </header>

      <div className="mb-6 border-b border-line">
        <EventNav eventId={event.id} />
      </div>

      {children}
    </div>
  );
}
