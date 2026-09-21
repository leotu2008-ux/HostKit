import { AgentCard } from "@/components/agent-card";
import type { Briefing } from "@/lib/agent/briefing";

/**
 * The agent as a persistent rail alongside every stage page for one event —
 * a pure view of the Briefing lib/agent/load.ts already computed. It never
 * computes anything of its own and never calls the model, so it can't say
 * anything the digest wouldn't.
 *
 * Unlike NightAdvicePanel (which can vanish entirely on a quiet night) this
 * rail is always present — a host should be able to glance at the same spot
 * on every page. But it must not manufacture work to fill the space: when
 * the briefing is empty it says so in one quiet line and stops.
 */
export function AgentPanel({
  briefing,
  eventId,
  canSend,
  venueSearchEnabled,
  className,
}: {
  briefing: Briefing;
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
  className?: string;
}) {
  return (
    <aside aria-labelledby="agent-heading" className={className}>
      <h2 id="agent-heading" className="font-display text-lg text-ink">Agent</h2>
      {briefing.headline ? (
        <p className="mt-0.5 text-[13px] text-ink-mute">{briefing.headline}</p>
      ) : null}

      <div className="mt-3 space-y-2">
        {briefing.items.length === 0 ? (
          <p className="text-[13px] text-ink-mute">Nothing needs you today.</p>
        ) : (
          briefing.items.map((item) => (
            <AgentCard
              key={item.id}
              item={item}
              eventId={eventId}
              canSend={canSend}
              venueSearchEnabled={venueSearchEnabled}
            />
          ))
        )}
      </div>
    </aside>
  );
}
