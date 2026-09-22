"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { describeMissing } from "@/lib/brief";
import { formatEventDate } from "@/lib/when";
import { relativeTime } from "@/lib/activity-format";
import type { AgentStatusView } from "@/lib/activity";
import { CreateEventButton } from "@/components/create-event-button";
import {
  BriefIcon,
  CheckIcon,
  ChevronIcon,
  GuestsIcon,
  OutreachIcon,
  OverviewIcon,
  PlanningIcon,
  VenueIcon,
} from "@/components/nav-icons";
import { cx } from "@/components/ui";

/**
 * The workspace's left rail: the brand, the event you're in (with a way to
 * jump to another), the six stages of running a night, and the agent's
 * pulse. It replaces components/event-sidebar.tsx, which was the same six
 * links with no shell around them. The account and the inbox belong to the
 * app bar, which carries them at every width.
 *
 * A client component for one reason — the active tab is the current URL.
 * Everything it renders past that is server data passed down as props, and
 * the switcher is a plain <details>, so opening it costs no JavaScript.
 *
 * Below lg it is the horizontal scroller it has always been: the six tabs
 * in a row above the app bar, without the brand, the switcher or the agent
 * card. Mobile is not the target, but it must not break.
 */

export type SwitcherEvent = { id: string; title: string; date: Date | null };

type SidebarTab = { href: string; label: string; match: string[]; Icon: () => React.JSX.Element };

const TABS: SidebarTab[] = [
  { href: "", label: "Overview", match: [], Icon: OverviewIcon },
  { href: "/brief", label: "Brief", match: [], Icon: BriefIcon },
  { href: "/plan", label: "Planning", match: ["/budget", "/runsheet"], Icon: PlanningIcon },
  { href: "/venue", label: "Venue", match: ["/agent/venues"], Icon: VenueIcon },
  { href: "/outreach", label: "Outreach", match: ["/discover", "/shortlist"], Icon: OutreachIcon },
  { href: "/guests", label: "Guests", match: ["/promote", "/blasts", "/check-in"], Icon: GuestsIcon },
];

const dotClass = "h-1.5 w-1.5 shrink-0 rounded-full";

/**
 * The status line's own affordance, sized for 13px text rather than the
 * page's primary Button.
 *
 * A POST to app/(workspace)/events/[id]/agent/run/route.ts rather than a
 * Server Action, because this rail is rendered by the layout on all six tabs
 * and a Server Action's timeout is the page's own maxDuration — see the
 * handler for the whole story. A plain form post, so it works without
 * hydration.
 */
function RunAgainButton({ eventId, label }: { eventId: string; label: string }) {
  return (
    <form method="post" action={`/events/${eventId}/agent/run`}>
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
  if (agent.status === "queued") {
    // A run the rate limit parked: nothing went wrong and nothing is lost —
    // the cron sweep picks QUEUED rows up — but without its own branch this
    // read as "Idle", offering a "Run again" that would only queue again.
    return (
      <>
        <span aria-hidden className={cx(dotClass, "bg-line-strong")} />
        <span className="text-ink-soft">Queued &mdash; starting soon</span>
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

/**
 * Which night you're planning, and the way out to the others. `switcher`
 * arrives with the current event still in it — it's marked with a check
 * rather than filtered out, so the list reads as "here's where you are
 * among your events" instead of "here's everywhere else".
 */
function EventSwitcher({ eventId, title, switcher }: { eventId: string; title: string; switcher: SwitcherEvent[] }) {
  return (
    <details className="group relative mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronIcon className="shrink-0 text-ink-mute transition-transform group-open:-rotate-180" />
      </summary>

      <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
        {switcher.map((row) => {
          const current = row.id === eventId;
          return (
            <Link
              key={row.id}
              href={`/events/${row.id}`}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-sunk"
            >
              <span className="min-w-0 flex-1 truncate text-ink">{row.title}</span>
              {current ? (
                <span className="shrink-0 text-ink-mute">
                  <CheckIcon />
                </span>
              ) : (
                <span className="shrink-0 text-[12px] text-ink-mute">
                  {formatEventDate(row.date) ?? "No date"}
                </span>
              )}
            </Link>
          );
        })}
        {switcher.length > 0 ? <div className="my-1 h-px bg-line" /> : null}
        <div className="p-1">
          <CreateEventButton size="sm" className="w-full" />
        </div>
        <Link
          href="/events"
          className="block rounded-md px-2.5 py-1.5 text-[13px] text-ink-soft hover:bg-sunk hover:text-ink"
        >
          All events →
        </Link>
      </div>
    </details>
  );
}

export function WorkspaceSidebar({
  eventId,
  title,
  switcher,
  agent,
  now,
}: {
  eventId: string;
  title: string;
  switcher: SwitcherEvent[];
  agent: AgentStatusView;
  now: string;
}): React.JSX.Element {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <nav
      aria-label="Event workspace"
      className="w-full shrink-0 border-b border-line bg-sunk/60 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:overflow-y-auto lg:border-r lg:border-b-0"
    >
      <div className="flex h-full flex-col p-3">
        {/* The brand doubles as the way back out to every event — the same
            job "My events" does in the app bar's breadcrumb. */}
        <Link href="/events" className="hidden items-center gap-2 px-1 lg:flex">
          <Image
            src="/logo.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-[6px] ring-1 ring-line"
          />
          <span className="font-event text-[15px] text-ink">
            Host<span className="text-brand">y</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <EventSwitcher eventId={eventId} title={title} switcher={switcher} />
        </div>

        <div className="flex gap-1 overflow-x-auto lg:mt-4 lg:flex-col lg:gap-0.5 lg:overflow-visible">
          {TABS.map((tab) => {
            const href = `${base}${tab.href}`;
            const active =
              pathname === href || tab.match.some((prefix) => pathname.startsWith(`${base}${prefix}`));
            const { Icon } = tab;
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]",
                  active
                    ? "bg-clay-wash font-medium text-clay-deep ring-1 ring-clay/20"
                    : "text-ink-soft hover:bg-surface/70 hover:text-ink",
                )}
              >
                <span className={active ? "text-clay" : "text-ink-mute"}>
                  <Icon />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className="mt-4 hidden rounded-lg border border-line bg-surface p-3 text-[12.5px] lg:block">
          <p className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">Agent</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <AgentStatusLine eventId={eventId} agent={agent} now={now} />
          </div>
        </div>

      </div>
    </nav>
  );
}
