"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEventAsAdminAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "Removing…" : "Confirm remove"}
    </Button>
  );
}

/** Two steps, no browser dialog: "Remove" arms it, "Confirm remove" deletes.
 *  Deleting an event can't be undone. */
export function AdminDeleteButton({ eventId, title }: { eventId: string; title: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setArmed(true)} aria-label={`Remove ${title}`}>
        Remove
      </Button>
    );
  }
  return (
    <form action={deleteEventAsAdminAction} className="flex items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
      <ConfirmButton />
    </form>
  );
}
