import { requireEvent } from "@/lib/session";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { briefKindLabel, readyToPublish } from "@/lib/brief";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { Badge, Button, ButtonLink } from "@/components/ui";
import { EventCover } from "@/components/event-cover";
import { ImageUpload } from "@/components/image-upload";
import { publishEventAction } from "@/lib/actions/events";
import { removeCoverAction, setCoverAction } from "@/lib/actions/photos";
import { AgentPanel } from "@/components/agent-panel";
import { EventSidebar } from "@/components/event-sidebar";
import { loadBriefing } from "@/lib/agent/load";
import { loadAgentStatus } from "@/lib/activity";
import { isVenueSearchConfigured } from "@/lib/venues/search";

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
  const [briefing, agent] = await Promise.all([loadBriefing(event), loadAgentStatus(event)]);

  return (
    <div className="px-4 py-4 md:py-2">
      <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sunk md:h-20 md:w-20">
            <EventCover id={event.id} title={event.title} coverUrl={event.coverUrl} sizes="160px" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-mute">
              <span>
                {briefKindLabel(event)}
                {event.city ? ` · ${event.city}` : ""}
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
          <ImageUpload
            upload={setCoverAction}
            remove={removeCoverAction}
            hasImage={Boolean(event.coverUrl)}
            fields={{ eventId: event.id }}
            label="Change cover"
          />
          <ButtonLink href={`/e/${event.id}`} variant="secondary" size="sm">
            Event page ↗
          </ButtonLink>
          {event.published ? null : !readyToPublish(event) ? (
            // A blank or half-brief event has nothing worth signing in to
            // publish yet — send the host to finish the brief first.
            <ButtonLink href={`/events/${event.id}/brief`} size="sm">
              Finish the brief
            </ButtonLink>
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

      {/* The workspace sidebar owns navigation now — a horizontal scroller
          below lg, a left rail alongside the content from lg up. The agent
          still rides alongside the stage pages rather than living behind
          its own tab, so it stays the thing watching the others rather than
          another app the host has to remember to visit: a right rail once
          the sidebar and content have room to share the row (xl+), and
          otherwise full width below the content.

          `app/(app)/layout.tsx` caps every page at max-w-5xl (1024px),
          which is the right width for a single-column page but starves
          this one: two fixed rails (220px + 320px) plus gaps leave the
          content column under 400px. Rather than widen the shell for
          every page, this three-column workspace alone breaks out of the
          5xl column at xl, growing symmetrically toward 80rem (1280px)
          and never past it. The negative margin is clamped to 0 below
          that breakpoint (min(...) with a 0px floor) so it's a no-op
          until the shell is actually the bottleneck. */}
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px] xl:gap-8 xl:-mx-[max(0px,min(8rem,calc((100vw-64rem)/2-1.5rem)))]">
        <EventSidebar eventId={event.id} agent={agent} now={new Date().toISOString()} />
        <div className="min-w-0">{children}</div>
        <AgentPanel
          briefing={briefing}
          eventId={event.id}
          canSend={Boolean(user?.email)}
          venueSearchEnabled={isVenueSearchConfigured()}
          className="mt-8 lg:col-span-2 lg:mt-6 xl:col-span-1 xl:mt-0"
        />
      </div>
    </div>
  );
}
