"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addCollaboratorAction,
  type CollaboratorFormState,
} from "@/lib/actions/collaborators";
import { Button, Field, FormError, Input } from "@/components/ui";
import type { CollaboratorKind } from "@/generated/prisma/enums";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : label}
    </Button>
  );
}

export function AddCollaboratorForm({
  eventId,
  kind,
  nameLabel,
  detailLabel,
  detailPlaceholder,
  submitLabel,
}: {
  eventId: string;
  kind: CollaboratorKind;
  nameLabel: string;
  detailLabel?: string;
  detailPlaceholder?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(
    addCollaboratorAction,
    undefined as CollaboratorFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="kind" value={kind} />
      <FormError>{state?.error}</FormError>
      <Field label={nameLabel}>
        <Input name="name" required maxLength={80} />
      </Field>
      {kind !== "VENUE" ? (
        <Field label="Email" hint="Optional.">
          <Input name="email" type="email" autoComplete="email" />
        </Field>
      ) : (
        <input type="hidden" name="email" value="" />
      )}
      <Field label={detailLabel ?? "Note"} hint="Optional.">
        <Input
          name="detail"
          placeholder={detailPlaceholder}
          maxLength={200}
        />
      </Field>
      <Submit label={submitLabel} />
    </form>
  );
}
