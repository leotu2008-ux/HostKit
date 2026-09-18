"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addRunSheetItemAction,
  generateRunSheetAction,
  regenerateRunSheetAction,
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

/** Same disabled-while-pending guard as Submit, but styled to match the
 *  ghost-text redraft/clear controls it sits beside rather than a filled
 *  Button — a double-click here inserts a second generated set. */
function GhostSubmit({
  label,
  busy,
  className,
}: {
  label: string;
  busy: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : label}
    </button>
  );
}

export function RedraftRunSheet({ eventId }: { eventId: string }) {
  return (
    <form action={regenerateRunSheetAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <GhostSubmit
        label="Redraft the run sheet"
        busy="Redrafting…"
        className="h-10 rounded-full px-4 text-sm font-medium text-ink-mute hover:text-ink disabled:pointer-events-none disabled:opacity-50"
      />
    </form>
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
      <div className="grid gap-3">
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
