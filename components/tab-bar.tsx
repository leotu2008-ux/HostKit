"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, match: "home" },
  { href: "/discover", label: "Discover", icon: DiscoverIcon, match: "discover" },
  { href: "/events/new", label: "Create", icon: CreateIcon, match: "create" },
  { href: "/events", label: "Events", icon: NightsIcon, match: "nights" },
  { href: "/profile", label: "Profile", icon: YouIcon, match: "you" },
] as const;

function tabActive(pathname: string, match: (typeof TABS)[number]["match"]) {
  if (match === "home") return pathname === "/";
  if (match === "discover") return pathname.startsWith("/discover");
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
      pathname === "/settings" ||
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

/** Top-bar navigation for wide screens; the tab bar covers phones. */
export function DesktopNav() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home", match: "home" },
    { href: "/discover", label: "Discover", match: "discover" },
    { href: "/events", label: "My events", match: "nights" },
  ] as const;

  return (
    <nav className="no-print hidden items-center gap-1 md:flex" aria-label="Main">
      {links.map((link) => {
        const active = tabActive(pathname, link.match);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-sunk text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  if (!shouldShowTabBar(pathname)) return null;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
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

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4V15h-5v5.5h-4A1.5 1.5 0 0 1 4 19v-7.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
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
