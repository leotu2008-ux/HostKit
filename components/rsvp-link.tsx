"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/** Copies a guest's personal RSVP link. There is no email sending in Hosty,
 *  so the host shares these themselves. */
export function RsvpLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/rsvp/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this guest's RSVP link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        "text-sm font-medium transition-colors",
        copied ? "text-forest" : "text-clay hover:underline",
      )}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
