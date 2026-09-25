"use client";

import { useActionState, useState } from "react";
import { inviteFromGuestBookAction, type GuestFormState } from "@/lib/actions/guests";
import { Button } from "@/components/ui";
import type { GuestBookEntry } from "@/lib/guest-book";

/** Pick people who came to earlier events and add them to this list.
 *  Emailing their RSVP link is a separate Send invites action. */
export function GuestBookPicker({ eventId, entries }: { eventId: string; entries: GuestBookEntry[] }) {
  const [state, action, pending] = useActionState<GuestFormState, FormData>(inviteFromGuestBookAction, undefined);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // A successful invite makes `refresh()` drop those people from `entries`,
  // but `picked` is our own state and won't shrink on its own. Rather than
  // clear it in an effect (which would cause an extra render), reset it
  // during render the moment a new `state` comes in from the action — the
  // pattern React's docs recommend for state that should reset when
  // something external changes.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.added) setPicked(new Set());
  }

  // Belt and suspenders: `picked` can still momentarily hold ids that just
  // dropped out of `entries` (e.g. this render hasn't reset it yet), so
  // derive the counts from what's actually still visible.
  const visible = new Set(entries.map((e) => e.id));
  const pickedVisible = [...picked].filter((id) => visible.has(id));
  const allPicked = pickedVisible.length === entries.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">From your guest book</h2>
          <p className="text-[13px] text-ink-mute">
            People who came to your other events. Adding them does not email anyone.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPicked(allPicked ? new Set() : new Set(entries.map((e) => e.id)))}
        >
          {allPicked ? "Clear" : "Select everyone"}
        </Button>
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            {entry.missedOut && i === 0 ? <GroupLabel>Missed out last time</GroupLabel> : null}
            {!entry.missedOut && entries[i - 1]?.missedOut ? <GroupLabel>Came before</GroupLabel> : null}
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                name="contactId"
                value={entry.id}
                checked={picked.has(entry.id)}
                onChange={() => toggle(entry.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{entry.name}</span>
                <span className="block truncate text-[12px] text-ink-mute">{entry.email}</span>
              </span>
              {entry.came > 0 ? (
                <span className="text-[12px] text-ink-mute">
                  came {entry.came} {entry.came === 1 ? "time" : "times"}
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.added ? (
        <p className="text-sm text-forest">
          Added {state.added} to the list. Send invites when you want the RSVP link emailed.
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending || pickedVisible.length === 0}>
        {pending ? "Adding…" : pickedVisible.length ? `Add ${pickedVisible.length} to the list` : "Add to the list"}
      </Button>
    </form>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-line bg-paper px-3 py-1.5 text-[12px] font-medium text-ink-mute">
      {children}
    </p>
  );
}
