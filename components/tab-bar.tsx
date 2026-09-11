"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/", label: "Discover", icon: DiscoverIcon, match: "discover" },
  { href: "/events/new", label: "Create", icon: CreateIcon, match: "create" },
  { href: "/events", label: "Nights", icon: NightsIcon, match: "nights" },
  { href: "/profile", label: "You", icon: YouIcon, match: "you" },
] as const;

function tabActive(pathname: string, match: (typeof TABS)[number]["match"]) {
  if (match === "discover") return pathname === "/";
  if (match === "create") return pathname === "/events/new";
  if (match === "nights") {
    return (
      pathname === "/events" ||
      (pathname.startsWith("/events/") && pathname !== "/events/new")
    );
  }
  if (match === "you") {
    return (
      pathname === "/profile" ||
      pathname === "/signin" ||
      pathname === "/signup"
    );
  }
  return false;
}

export function shouldShowTabBar(pathname: string) {
  if (pathname.startsWith("/rsvp/")) return false;
  if (pathname.startsWith("/e/")) return false;
  return true;
}

export function TabBar() {
  const pathname = usePathname();
  if (!shouldShowTabBar(pathname)) return null;

  return (
    <nav
      className="no-print sticky bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tabActive(pathname, tab.match);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-clay" : "text-ink-mute",
                )}
              >
                <Icon active={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <path
        d="M16 16.5 20.5 21"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CreateIcon({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-full",
        active ? "bg-clay text-white" : "bg-sunk text-ink-soft",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function NightsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <path
        d="M4 10h16M8 3.5v3M16 3.5v3"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function YouIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="8"
        r="3.2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <path
        d="M5.5 19c1.4-3 4-4.5 6.5-4.5S17.1 16 18.5 19"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
