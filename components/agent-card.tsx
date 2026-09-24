import { Button, ButtonLink, cx } from "@/components/ui";
import { toggleTaskAction } from "@/lib/actions/tasks";
import { setEventTypeAction } from "@/lib/actions/brief";
import type { BriefingItem } from "@/lib/agent/briefing";

/**
 * One row in Hosty's message, one action. The panel is a list of things that
 * need the host, not a menu of ways to respond — so every row ends in exactly
 * one button, and the switch below is exhaustive: a new BriefingAction
 * variant fails to compile here until this file knows how to render it.
 *
 * The detail sits under the title as one short muted line, visible to
 * everyone and read once by screen readers.
 */
export function AgentCard({
  item,
  eventId,
  canSend,
  venueSearchEnabled,
}: {
  item: BriefingItem;
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{item.title}</p>
        <p className="text-[12px] text-ink-soft">{item.detail}</p>
        <p className={cx("text-[12px]", item.urgency === "now" ? "text-amber" : "text-ink-mute")}>
          {item.urgency === "now" ? "Needs you today" : "Coming up"}
        </p>
      </div>
      <div className="shrink-0">
        <AgentCardAction
          action={item.action}
          eventId={eventId}
          canSend={canSend}
          venueSearchEnabled={venueSearchEnabled}
        />
      </div>
    </li>
  );
}

function AgentCardAction({
  action,
  eventId,
  canSend,
  venueSearchEnabled,
}: {
  action: BriefingItem["action"];
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
}) {
  switch (action.type) {
    case "complete_task":
      return (
        <form action={toggleTaskAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="taskId" value={action.taskId} />
          <Button size="sm" type="submit">
            {action.label}
          </Button>
        </form>
      );

    case "open_outreach":
      // A host who isn't signed in with an email can't send yet — point them
      // at sign-in instead of a button that would only fail later.
      if (!canSend) {
        return (
          <ButtonLink
            href={`/signin?next=${encodeURIComponent(`/events/${eventId}/outreach`)}`}
            variant="secondary"
            size="sm"
          >
            Sign in to send
          </ButtonLink>
        );
      }
      return (
        <ButtonLink href={`/events/${eventId}/outreach`} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      );

    case "open_runsheet":
      return (
        <ButtonLink href={`/events/${eventId}/runsheet`} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      );

    case "open_plan":
      return (
        <ButtonLink href={`/events/${eventId}/plan`} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      );

    case "open_blast":
      // Opens the drafted blast; the host edits it and presses send there.
      return (
        <ButtonLink href={`/events/${eventId}/blasts?draft=${action.draft}`} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      );

    case "set_type":
      // The host settles the type Jev wasn't sure of; nothing else changes.
      return (
        <form action={setEventTypeAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="type" value={action.eventType} />
          <Button size="sm" variant="secondary" type="submit">
            {action.label}
          </Button>
        </form>
      );

    case "find_venues":
      // Venue search dark-launches until Apple Maps is configured, in which
      // case the Venue tab is where a host can actually see results.
      return venueSearchEnabled ? (
        <ButtonLink href={`/events/${eventId}/venue`} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      ) : (
        <ButtonLink href={`/events/${eventId}/outreach`} variant="secondary" size="sm">
          Add a venue
        </ButtonLink>
      );

    default: {
      // Exhaustive: a new BriefingAction variant fails to compile here, not
      // just at runtime.
      const _exhaustive: never = action;
      throw new Error(`Unknown agent action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
