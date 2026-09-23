import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { daysUntil } from "@/lib/plan";
import { AgentPanel } from "@/components/agent-panel";
import { WorkspaceBar } from "@/components/workspace-bar";
import { WorkspaceSidebar, type SwitcherEvent } from "@/components/workspace-sidebar";
import { loadBriefing } from "@/lib/agent/load";
import { loadAgentStatus } from "@/lib/activity";
import { isVenueSearchConfigured } from "@/lib/venues/search";

export async function generateMetadata({ params }: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  return { title: event.title };
}

/**
 * The workspace shell: a sidebar, an app bar, one content column and the
 * agent's rail.
 *
 * The sidebar owns navigation and the app bar owns identity and the publish
 * decision, so a stage page renders nothing but its own content — the same
 * furniture in the same place on all six tabs. The agent still rides
 * alongside the stage pages rather than living behind its own tab, so it
 * stays the thing watching the others rather than another app the host has
 * to remember to visit: a right rail once the sidebar and content have room
 * to share the row (xl+), and otherwise under the content.
 *
 * This layout no longer has to fight the shared max-w-5xl column — the
 * workspace has its own route group (app/(workspace)/layout.tsx) with no
 * column of its own, so the old negative-margin breakout is gone.
 */
export default async function EventLayout({
  children,
  params,
}: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const { event, user } = await requireEvent(id);
  const days = daysUntil(event.date);

  const [briefing, agent, switcher] = await Promise.all([
    loadBriefing(event),
    loadAgentStatus(event),
    // The switcher's list. A signed-out draft holder has no account to list
    // events from — the switcher shows them just "Create event" and the way
    // to /events. Live nights only, soonest first, and a ceiling: this is a
    // jump list, not the events page.
    user
      ? db.event.findMany({
          where: { ownerId: user.id, status: { in: ["PLANNING", "CONFIRMED"] } },
          orderBy: [{ date: "asc" }],
          take: 12,
          select: { id: true, title: true, date: true },
        })
      : Promise.resolve([] as SwitcherEvent[]),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      <WorkspaceSidebar
        eventId={event.id}
        title={event.title}
        switcher={switcher}
        agent={agent}
        now={new Date().toISOString()}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceBar event={event} days={days} signedIn={Boolean(user)} isOwner={user?.id === event.ownerId} />
        <div className="flex-1 px-6 py-6 md:px-8">
          <div className="mx-auto max-w-[1180px] xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
            <div className="min-w-0">{children}</div>
            <AgentPanel
              briefing={briefing}
              eventId={event.id}
              canSend={Boolean(user?.email)}
              venueSearchEnabled={isVenueSearchConfigured()}
              className="mt-8 xl:mt-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
