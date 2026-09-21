"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { describeMissing, type BriefField } from "@/lib/brief";
import { cx } from "@/components/ui";

/**
 * The workspace's left rail — the six stages of running a night, replacing
 * the old top strip (components/event-nav.tsx, still on disk for Milestone 4
 * to remove once every page it links has a home under one of these tabs).
 */

export type SidebarTab = { href: string; label: string; match: string[] };

/** The agent's state, as the sidebar needs to know it. Milestone 2 moves
 *  this type to lib/activity.ts once a real loader produces it; today the
 *  layout builds a placeholder straight from the brief. */
export type AgentStatusView = {
  status: "idle" | "queued" | "running" | "failed" | "done";
  lastRunAt: string | null;
  startedAt: string | null;
  needs: BriefField[];
};

// The Venue tab points at the existing agent/venues page for now — Milestone
// 4 moves it to its own /venue route, hence the match prefix already here.
const TABS: SidebarTab[] = [
  { href: "", label: "Overview", match: [] },
  { href: "/brief", label: "Brief", match: [] },
  { href: "/plan", label: "Planning", match: ["/budget", "/runsheet"] },
  { href: "/agent/venues", label: "Venue", match: ["/venue"] },
  { href: "/outreach", label: "Outreach", match: ["/discover", "/shortlist"] },
  { href: "/guests", label: "Guests", match: ["/promote", "/blasts", "/check-in"] },
];

const dotClass = "h-1.5 w-1.5 shrink-0 rounded-full";

function AgentStatusLine({ eventId, agent }: { eventId: string; agent: AgentStatusView }) {
  if (agent.status === "running") {
    return (
      <>
        <span aria-hidden className={cx(dotClass, "bg-brand animate-pulse")} />
        <span className="text-ink-soft">Working on this now…</span>
      </>
    );
  }
  if (agent.needs.length > 0) {
    return (
      <>
        <span aria-hidden className={cx(dotClass, "bg-line-strong")} />
        <Link href={`/events/${eventId}/brief`} className="text-ink-soft hover:text-ink">
          Needs {describeMissing(agent.needs)}
        </Link>
      </>
    );
  }
  if (agent.status === "failed") {
    return (
      <>
        <span aria-hidden className={cx(dotClass, "bg-amber")} />
        <span className="text-ink-soft">Last run didn&rsquo;t finish</span>
      </>
    );
  }
  // Milestone 3 adds "ran 2h ago" from lastRunAt plus a Run again button.
  return (
    <>
      <span aria-hidden className={cx(dotClass, "bg-forest")} />
      <span className="text-ink-soft">Idle</span>
    </>
  );
}

export function EventSidebar({
  eventId,
  agent,
}: {
  eventId: string;
  agent: AgentStatusView;
}): React.JSX.Element {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <nav aria-label="Event workspace">
      <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible lg:gap-0.5">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active =
            pathname === href || tab.match.some((prefix) => pathname.startsWith(`${base}${prefix}`));
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-10 items-center rounded-lg px-3 text-[15px]",
                active ? "bg-sunk font-medium text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="hidden items-center gap-2 border-t border-line pt-3 text-[13px] lg:mt-4 lg:flex">
        <AgentStatusLine eventId={eventId} agent={agent} />
      </div>
    </nav>
  );
}
