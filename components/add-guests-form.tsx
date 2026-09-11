"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addGuestsAction, type GuestFormState } from "@/lib/actions/guests";
import { Button, Field, FormError, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add to the list"}
    </Button>
  );
}

export function AddGuestsForm({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState<GuestFormState, FormData>(
    addGuestsAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      {state?.added ? (
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">
          Added {state.added} {state.added === 1 ? "guest" : "guests"}.
        </p>
      ) : null}
      <Field
        label="Add guests"
        hint="One per line. Paste from wherever your list already lives — “Name <email>”, “Name, email” or just a name all work."
      >
        <Textarea
          name="guests"
          rows={4}
          placeholder={"Ada Lovelace <ada@example.com>\nGrace Hopper, grace@example.com\nAlan Turing"}
        />
      </Field>
      <Submit />
    </form>
  );
}
