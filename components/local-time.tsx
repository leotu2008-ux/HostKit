"use client";

import { useSyncExternalStore } from "react";

/**
 * A moment Hosty stamped with now() (a check-in, a blast going out), shown in
 * the reader's own time zone.
 *
 * The server formats in its own clock (UTC on Vercel), so a 7:30 PM check-in
 * in New York would read "11:30 PM" and a 9 PM blast would be dated tomorrow.
 * Event times are wall-clock and don't go through here (lib/when.ts).
 *
 * The server renders an empty <time>; the local text arrives at hydration
 * without a mismatch and without an effect (the idiom
 * components/install-prompt.tsx uses for the same reason).
 */

export type InstantFormat = "time" | "date";

const OPTIONS: Record<InstantFormat, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric" },
};

/** `timeZone` is for tests; the browser's own zone is the default. */
export function formatInstant(iso: string, format: InstantFormat, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-US", { ...OPTIONS[format], timeZone });
}

function subscribeNothing() {
  return () => {};
}

export function LocalTime({ iso, format }: { iso: string; format: InstantFormat }) {
  const inBrowser = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return <time dateTime={iso}>{inBrowser ? formatInstant(iso, format) : null}</time>;
}
