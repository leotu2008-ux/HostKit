"use client";

import { useOptimistic, useTransition } from "react";
import { toggleSavedAction } from "@/lib/actions/shortlist";
import { cx } from "@/components/ui";

/**
 * Shortlist toggle. Optimistic because a save that waits on a round trip
 * reads as a broken button, and the failure mode (a save that didn't stick)
 * is visible on the next render anyway.
 */
export function SaveButton({
  eventId,
  listingId,
  saved,
  variant = "button",
}: {
  eventId: string;
  listingId: string;
  saved: boolean;
  variant?: "button" | "icon";
}) {
  const [, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);

  function submit() {
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("listingId", listingId);
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      await toggleSavedAction(data);
    });
  }

  const label = optimisticSaved ? "Remove from shortlist" : "Add to shortlist";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={submit}
        aria-label={label}
        aria-pressed={optimisticSaved}
        className={cx(
          "flex size-9 items-center justify-center rounded-full border transition-colors",
          optimisticSaved
            ? "border-clay bg-clay text-on-clay"
            : "border-line-strong bg-surface/90 text-ink-soft hover:border-ink-mute hover:text-ink",
        )}
      >
        <BookmarkIcon filled={optimisticSaved} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={submit}
      aria-pressed={optimisticSaved}
      className={cx(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors",
        optimisticSaved
          ? "border-clay bg-clay-wash text-clay-deep"
          : "border-line-strong bg-surface text-ink hover:border-ink-mute",
      )}
    >
      <BookmarkIcon filled={optimisticSaved} />
      {optimisticSaved ? "Shortlisted" : "Add to shortlist"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        d="M4 2.5h8a.5.5 0 0 1 .5.5v10.2a.3.3 0 0 1-.47.25L8 10.6l-4.03 2.85a.3.3 0 0 1-.47-.25V3a.5.5 0 0 1 .5-.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
