"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { describeMissing } from "@/lib/brief";
import { relativeTime } from "@/lib/activity-format";
import type { AgentStatusView } from "@/lib/activity";
import { runAgentAction } from "@/lib/actions/agent";
import { cx } from "@/components/ui";

/**
 * The workspace's left rail — the six stages of running a night, replacing
 * the old top strip (components/event-nav.tsx, still on disk for Milestone 4
 * to remove once every page it links has a home under one of these tabs).
 */

export type SidebarTab = { href: string; label: string; match: string[] };

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

/** The status line's own affordance, sized for 13px text rather than the
 *  page's primary Button. */
function RunAgainButton({ eventId, label }: { eventId: string; label: string }) {
  return (
    <form action={runAgentAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" className="text-clay hover:underline">
        {label}
      </button>
    </form>
  );
}

function AgentStatusLine({
  eventId,
  agent,
  now,
}: {
  eventId: string;
  agent: AgentStatusView;
  now: string;
}) {
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
        <RunAgainButton eventId={eventId} label="Try again" />
      </>
    );
  }
  return (
    <>
      <span aria-hidden className={cx(dotClass, "bg-forest")} />
      <span className="text-ink-soft">
        Idle
        {/* `now` comes from the server render so this string is the same on
            both sides of hydration. */}
        {agent.lastRunAt ? ` · ran ${relativeTime(agent.lastRunAt, new Date(now))}` : ""}
      </span>
      <RunAgainButton eventId={eventId} label="Run again" />
    </>
  );
}

export function EventSidebar({
  eventId,
  agent,
  now,
}: {
  eventId: string;
  agent: AgentStatusView;
  now: string;
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

      <div className="hidden flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-[13px] lg:mt-4 lg:flex">
        <AgentStatusLine eventId={eventId} agent={agent} now={now} />
      </div>
    </nav>
  );
}
