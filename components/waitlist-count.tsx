"use client";

import { useSyncExternalStore } from "react";

/**
 * "142 people on the waitlist", under each "Join the waitlist" button.
 *
 * The server passes the cached count. A signup on this tab publishes the
 * fresh count here (see AuthForm), so going back to the landing page shows
 * the new number even before the server's copy is read again.
 */

let latest: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return latest;
}

function serverSnapshot() {
  return null;
}

/** Records the count a signup just read, for every WaitlistCount on the page. */
export function publishWaitlistCount(count: number | null | undefined) {
  if (typeof count !== "number") return;
  latest = count;
  for (const listener of listeners) listener();
}

/** "142 people on the waitlist", or null when there is nothing worth showing. */
export function waitlistCountLabel(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isInteger(count) || count <= 0) return null;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "person" : "people"} on the waitlist`;
}

export function WaitlistCount({
  count,
  className,
}: {
  /** The server's count; null when it couldn't be read. */
  count: number | null | undefined;
  className?: string;
}) {
  const joined = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // Whichever is newer: a signup's fresh read, or a server count taken since.
  const shown = joined === null ? count : Math.max(joined, count ?? 0);
  const label = waitlistCountLabel(shown);
  if (!label) return null;
  return (
    <p className={className} aria-live="polite">
      {label}
    </p>
  );
}
