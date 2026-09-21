import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { toggleTaskAction } from "@/lib/actions/tasks";
import type { BriefingItem } from "@/lib/agent/briefing";

/**
 * One card, one action. The panel is a list of things that need the host,
 * not a place to offer them a menu of ways to respond — so every card ends
 * in exactly one button, and the switch below is exhaustive: a new
 * BriefingAction variant fails to compile here until this file knows how to
 * render it.
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
    <Card className="flex items-start justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <Badge tone={item.urgency === "now" ? "amber" : "neutral"} className="mb-1.5">
          {item.urgency === "now" ? "Now" : "Soon"}
        </Badge>
        <p className="text-[13px] font-medium text-ink">{item.title}</p>
        <p className="text-[13px] text-ink-soft">{item.detail}</p>
      </div>
      <div className="shrink-0">
        <AgentCardAction
          action={item.action}
          eventId={eventId}
          canSend={canSend}
          venueSearchEnabled={venueSearchEnabled}
        />
      </div>
    </Card>
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
