import { AgentCard } from "@/components/agent-card";
import { HostyMark } from "@/components/hosty-mark";
import type { Briefing } from "@/lib/agent/briefing";
import { briefingIntro } from "@/lib/hosty-voice";

/**
 * Hosty's latest message, as a persistent rail beside every stage page for
 * one event. A pure view of the Briefing lib/agent/load.ts already computed:
 * it never computes anything of its own and never calls the model, so it
 * can't say anything the digest wouldn't.
 *
 * It's always present, so a host can glance at the same spot on every page,
 * but it doesn't manufacture work to fill the space. When the briefing is
 * empty, Hosty says so in one line and stops.
 */
export function AgentPanel({
  briefing,
  eventId,
  canSend,
  venueSearchEnabled,
  firstName,
  className,
}: {
  briefing: Briefing;
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
  firstName: string | null;
  className?: string;
}) {
  return (
    <aside aria-labelledby="agent-heading" className={className}>
      <h2 id="agent-heading" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <HostyMark size={20} />
        <span>Hosty</span>
        {briefing.headline ? (
          <span className="text-[13px] font-normal text-ink-mute">· {briefing.headline}</span>
        ) : null}
      </h2>

      <div className="mt-3 rounded-2xl rounded-tl-md bg-sunk p-3.5">
        <p className="text-[13.5px] leading-snug text-ink">{briefingIntro(briefing, firstName)}</p>
        {briefing.items.length > 0 ? (
          <ul className="mt-2.5 divide-y divide-line">
            {briefing.items.map((item) => (
              <AgentCard
                key={item.id}
                item={item}
                eventId={eventId}
                canSend={canSend}
                venueSearchEnabled={venueSearchEnabled}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
