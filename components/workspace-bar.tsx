import Link from "next/link";
import { readyToPublish, type BriefFacts } from "@/lib/brief";
import { describeCountdown } from "@/lib/plan";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { publishEventAction } from "@/lib/actions/events";
import { Badge, Button, ButtonLink } from "@/components/ui";
import type { EventVisibility } from "@/generated/prisma/enums";

/**
 * The workspace's app bar: where you are, how long you've got, whether
 * guests can see it, and the one publish decision. It replaces the cover
 * header the event layout used to open with — a 20px title over an 80px
 * photo, which is a magazine's furniture, not a product's. The cover itself
 * moved to the Brief tab, where it is one of the facts about the night
 * rather than the frame around every page.
 *
 * A server component: it renders the publish form directly, exactly as the
 * layout did, so nothing about who may publish or what happens when they do
 * has changed.
 */
export function WorkspaceBar({
  event,
  days,
  signedIn,
}: {
  /** The whole brief, because readyToPublish reads all of it. */
  event: BriefFacts & { id: string; published: boolean; visibility: EventVisibility };
  days: number | null;
  signedIn: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-6 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {/* Always visible, at every width: with the marketing chrome hidden
            inside the workspace this breadcrumb is the way back out. */}
        <Link href="/events" className="shrink-0 text-[13px] text-ink-mute hover:text-ink">
          My events
        </Link>
        <span aria-hidden className="shrink-0 text-[13px] text-ink-mute">
          /
        </span>
        <span className="truncate text-[14px] font-medium text-ink">{event.title}</span>
      </div>

      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <Badge tone={days !== null && days >= 0 && days <= 14 ? "amber" : "neutral"}>
          {describeCountdown(days)}
        </Badge>
        <Badge tone={event.published ? "forest" : "neutral"}>
          {event.published ? VISIBILITY_LABEL[event.visibility] : "Draft"}
        </Badge>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ButtonLink href={`/e/${event.id}`} variant="secondary" size="sm">
          Event page ↗
        </ButtonLink>
        {event.published ? null : !readyToPublish(event) ? (
          // A blank or half-brief event has nothing worth signing in to
          // publish yet — send the host to finish the brief first.
          <ButtonLink href={`/events/${event.id}/brief`} size="sm">
            Finish the brief
          </ButtonLink>
        ) : signedIn ? (
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
  );
}
