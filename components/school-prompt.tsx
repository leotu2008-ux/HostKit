"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const KEY = "hostkit.schoolPromptDismissed";

const noop = () => () => {};
function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One nudge, on Home, for a signed-in person with no school: the campus
 * feed and the official calendar only switch on once they pick one.
 * Dismissed once, it stays gone on this browser. Hidden during server
 * render so it never flashes for people who already said no.
 */
export function SchoolPrompt() {
  const dismissedBefore = useSyncExternalStore(noop, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);
  if (dismissedBefore || dismissedNow) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Private mode: it just shows again next time.
    }
    setDismissedNow(true);
  };
  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-4 md:flex md:items-center md:justify-between md:gap-6">
      <div>
        <p className="font-medium text-ink">Are you a student?</p>
        <p className="mt-0.5 text-[14px] text-ink-soft">
          Pick your school and Discover leads with your campus — official events included.
        </p>
      </div>
      <div className="mt-3 flex shrink-0 gap-2 md:mt-0">
        <Link
          href="/profile"
          onClick={dismiss}
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:opacity-90"
        >
          Pick my school
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
        >
          Not a student
        </button>
      </div>
    </div>
  );
}
