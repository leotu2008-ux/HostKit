"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/plan", label: "Plan" },
  { href: "/budget", label: "Budget" },
  { href: "/discover", label: "Discover" },
  { href: "/shortlist", label: "Shortlist" },
];

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <nav className="no-print -mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "border-clay text-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
