"use client";

import { useActionState } from "react";
import { sendGuestInvitesAction, type InviteFormState } from "@/lib/actions/guests";
import { inviteResultCopy } from "@/lib/guest-invites";
import { Button, FormError } from "@/components/ui";

/**
 * The explicit send. Adding a guest is a different form and does not use
 * this action. `guestId` emails that one row; without it, the whole list.
 */
export function SendInvitesForm({
  eventId,
  guestId,
  guestName,
}: {
  eventId: string;
  guestId?: string;
  guestName?: string;
}) {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    sendGuestInvitesAction,
    undefined,
  );
  const one = Boolean(guestId);
  const result =
    state && typeof state.sent === "number" && typeof state.skippedNoEmail === "number"
      ? inviteResultCopy(state.sent, state.skippedNoEmail)
      : null;

  return (
    <form action={action} className={one ? "flex flex-col items-start" : "mb-4 space-y-3"}>
      <input type="hidden" name="eventId" value={eventId} />
      {guestId ? <input type="hidden" name="guestId" value={guestId} /> : null}
      {one ? (
        <button
          type="submit"
          disabled={pending}
          aria-label={guestName ? `Email ${guestName} their RSVP link` : "Email RSVP link"}
          className="text-sm font-medium text-clay hover:underline disabled:opacity-50"
        >
          {pending ? "Sending…" : "Email RSVP link"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send invites"}
          </Button>
          <p className="text-sm text-ink-mute">
            Emails each guest their RSVP link. Anyone without an email is skipped.
          </p>
        </div>
      )}
      <FormError>{state?.error}</FormError>
      {result ? (
        <p role="status" className={one ? "max-w-56 text-xs text-forest" : "text-sm text-forest"}>
          {result}
        </p>
      ) : null}
    </form>
  );
}
