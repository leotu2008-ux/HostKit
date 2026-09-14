"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { shouldShowTabBar } from "@/components/tab-bar";

/**
 * Tells iOS users how to install Student Events to their home screen.
 *
 * iOS has no install-prompt API — the only path is Safari's Share sheet, and
 * the only way to get there is to say so. Shown only on iOS, only in a
 * browser tab (never once already running standalone from the home screen),
 * and never on guest-facing pages, where nagging a guest to install the
 * host's app would be wrong.
 *
 * Eligibility comes from useSyncExternalStore with a server snapshot of
 * `false`: the server can't see the user agent, so it renders nothing, and
 * React swaps in the real answer after hydration without a mismatch and
 * without an effect.
 */

const DISMISSED_KEY = "hostkit.install-prompt.dismissed";

/** Nothing here changes after page load, so there is nothing to subscribe to. */
function subscribe() {
  return () => {};
}

function readEligibility(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // Older iOS exposes this non-standard flag instead of display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  let dismissed = false;
  try {
    dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private browsing can throw on storage access; treat as not dismissed.
  }

  return isIOS && !standalone && !dismissed;
}

export function InstallPrompt() {
  const pathname = usePathname();
  const eligible = useSyncExternalStore(
    subscribe,
    readEligibility,
    () => false,
  );
  // Dismissal this session. Persisted to storage too, so the next visit's
  // readEligibility() sees it; this state just hides it immediately.
  const [dismissed, setDismissed] = useState(false);

  if (!eligible || dismissed || !shouldShowTabBar(pathname)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // If storage is unavailable the prompt simply returns next visit.
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="no-print flex items-center gap-3 border-t border-line bg-clay-wash px-4 py-2.5 text-[13px] text-clay-deep"
    >
      <ShareIcon />
      <p className="min-w-0 flex-1 leading-snug">
        Add Student Events to your home screen: tap{" "}
        <span className="font-semibold">Share</span>, then{" "}
        <span className="font-semibold">Add to Home Screen</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-clay-deep/70 hover:bg-clay/10 hover:text-clay-deep"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** The iOS share glyph — a box with an arrow rising out of it. */
function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M12 3v12M8 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
