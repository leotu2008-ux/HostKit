"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const PRIMARY = [
  { href: "", label: "Dashboard" },
  { href: "/guests", label: "Guests" },
  { href: "/check-in", label: "Door" },
];

const MORE = [
  { href: "/plan", label: "Plan" },
  { href: "/budget", label: "Budget" },
  { href: "/discover", label: "Scout" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/runsheet", label: "Run sheet" },
];

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const moreActive = MORE.some((tab) => pathname.startsWith(`${base}${tab.href}`));

  return (
    <div>
      <nav className="no-print flex gap-1 overflow-x-auto" aria-label="Manage">
        {PRIMARY.map((tab) => {
          const href = `${base}${tab.href}`;
          const active =
            tab.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium",
                active ? "bg-clay text-white" : "bg-sunk text-ink-soft",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="no-print mt-2 flex gap-1 overflow-x-auto pb-1"
        aria-label="Plan"
      >
        {MORE.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium",
                active ? "bg-clay-wash text-clay-deep" : "text-ink-mute",
                moreActive && !active ? "text-ink-soft" : null,
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
