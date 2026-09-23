"use client";

import { useActionState, useState } from "react";
import { inviteFromGuestBookAction, type GuestFormState } from "@/lib/actions/guests";
import { Button } from "@/components/ui";
import type { GuestBookEntry } from "@/lib/guest-book";

/** Pick people who came to your earlier events and invite them in one go. */
export function GuestBookPicker({ eventId, entries }: { eventId: string; entries: GuestBookEntry[] }) {
  const [state, action, pending] = useActionState<GuestFormState, FormData>(inviteFromGuestBookAction, undefined);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const allPicked = picked.size === entries.length;

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
          <p className="text-[13px] text-ink-mute">People who came to your other events.</p>
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
        {entries.map((entry) => (
          <li key={entry.id}>
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
              <span className="text-[12px] text-ink-mute">
                came {entry.came} {entry.came === 1 ? "time" : "times"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.added ? <p className="text-sm text-forest">Invited {state.added}.</p> : null}
      <Button type="submit" size="sm" disabled={pending || picked.size === 0}>
        {pending ? "Inviting…" : `Invite ${picked.size || ""}`.trim()}
      </Button>
    </form>
  );
}
