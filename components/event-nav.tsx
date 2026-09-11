"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { cx } from "@/components/ui";

/** Running the night first (people, outreach, promotion), then the planner. */
const GROUPS = [
  [
    { href: "", label: "Overview" },
    { href: "/outreach", label: "Outreach" },
    { href: "/blasts", label: "Blasts" },
    { href: "/promote", label: "Promote" },
    { href: "/guests", label: "Guests" },
    { href: "/check-in", label: "Door" },
  ],
  [
    { href: "/plan", label: "Plan" },
    { href: "/budget", label: "Budget" },
    { href: "/discover", label: "Scout" },
    { href: "/shortlist", label: "Shortlist" },
    { href: "/runsheet", label: "Run sheet" },
  ],
];

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <nav
      className="no-print -mb-px flex items-stretch gap-5 overflow-x-auto"
      aria-label="Manage event"
    >
      {GROUPS.map((group, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className="my-3 w-px shrink-0 bg-line-strong" />
          ) : null}
          {group.map((tab) => {
            const href = `${base}${tab.href}`;
            const active =
              tab.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "shrink-0 border-b-2 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-mute hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
