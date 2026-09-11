"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Badge, cx } from "@/components/ui";

export type MenuUser = {
  name: string;
  email: string;
  imageUrl?: string | null;
  school?: { name: string; short: string } | null;
  classYear?: number | null;
};

const ROWS = [
  { href: "/profile", label: "Profile", hint: "Name, photo, bio" },
  { href: "/events", label: "My events", hint: "Upcoming nights you host" },
  { href: "/events?tab=past", label: "Past events", hint: "Everything you've hosted" },
  { href: "/settings", label: "Settings", hint: "Phone number, account" },
];

/**
 * The menu behind the logo (and the avatar): who you are, your events, and
 * settings. A popover on wide screens, a bottom sheet on phones. The trigger
 * is whatever is passed as children.
 */
export function AccountMenu({
  user,
  signOut,
  align = "left",
  label,
  children,
}: {
  user: MenuUser | null;
  signOut: () => Promise<void>;
  align?: "left" | "right";
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  // Navigating anywhere closes it; the pathname is the trigger, not an effect on state.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        {children}
      </button>

      {open ? (
        <>
          <div aria-hidden className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setOpen(false)} />
          <div
            id={id}
            role="menu"
            className={cx(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-line bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgb(0_0_0/0.15)]",
              "md:absolute md:inset-x-auto md:bottom-auto md:top-12 md:w-80 md:rounded-2xl md:shadow-[0_16px_50px_rgb(0_0_0/0.14)]",
              align === "left" ? "md:left-0" : "md:right-0",
            )}
          >
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={user.name} imageUrl={user.imageUrl} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[13px] text-ink-soft">{user.email}</p>
                    {user.school ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="clay">{user.school.short}</Badge>
                        {user.classYear ? <Badge>Class of {user.classYear}</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="my-1 h-px bg-line" />
                {ROWS.map((row) => (
                  <Link
                    key={row.href}
                    role="menuitem"
                    href={row.href}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-sunk"
                  >
                    <span>
                      <span className="block text-[15px] font-medium text-ink">{row.label}</span>
                      <span className="block text-[12px] text-ink-mute">{row.hint}</span>
                    </span>
                    <span aria-hidden className="text-ink-mute">
                      ›
                    </span>
                  </Link>
                ))}
                <div className="my-1 h-px bg-line" />
                <form action={signOut}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="w-full rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-danger hover:bg-danger-wash"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="px-3 py-3">
                  <p className="font-semibold text-ink">Host your own nights</p>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    Sign in to publish events, see your guest list and register in a tap.
                  </p>
                </div>
                <Link role="menuitem" href="/signin" className="block rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-sunk">
                  Sign in
                </Link>
                <Link role="menuitem" href="/signup" className="block rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-sunk">
                  Create an account
                </Link>
                <Link role="menuitem" href="/events" className="block rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-sunk">
                  Drafts on this device
                </Link>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
