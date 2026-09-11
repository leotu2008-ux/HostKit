"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addRunSheetItemAction,
  generateRunSheetAction,
  type RunSheetFormState,
} from "@/lib/actions/runsheet";
import { Button, Field, FormError, Input } from "@/components/ui";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function GenerateRunSheet({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState<RunSheetFormState, FormData>(
    generateRunSheetAction,
    undefined,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <Submit label="Build me a starting point" busy="Building…" />
    </form>
  );
}

export function AddRunSheetItem({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState<RunSheetFormState, FormData>(
    addRunSheetItemAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_180px_auto] sm:items-end">
        <Field label="Time">
          <Input name="time" type="time" defaultValue="18:00" required />
        </Field>
        <Field label="What happens">
          <Input name="title" placeholder="Speeches" required />
        </Field>
        <Field label="Who's on it">
          <Input name="owner" placeholder="Optional" />
        </Field>
        <Submit label="Add" busy="Adding…" />
      </div>
    </form>
  );
}
