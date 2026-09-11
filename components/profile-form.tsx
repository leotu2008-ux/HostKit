"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction, type ProfileFormState } from "@/lib/actions/profile";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

export function ProfileForm({
  name,
  classYear,
  bio,
  isStudent,
}: {
  name: string;
  classYear: number | null;
  bio: string | null;
  isStudent: boolean;
}) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state?.error}</FormError>
      {state?.saved ? (
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">Saved.</p>
      ) : null}
      <Field label="Name">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      {isStudent ? (
        <Field label="Class year" hint="Optional — shows on your events.">
          <Input
            name="classYear"
            type="number"
            inputMode="numeric"
            placeholder={String(new Date().getFullYear() + 2)}
            defaultValue={classYear ?? ""}
            className="w-32"
          />
        </Field>
      ) : null}
      <Field label="About you" hint="One line. Optional.">
        <Textarea name="bio" rows={2} maxLength={200} defaultValue={bio ?? ""} />
      </Field>
      <Submit />
    </form>
  );
}
