"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ClubFormState } from "@/lib/actions/clubs";
import { Button, FormError, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add admin"}
    </Button>
  );
}

/** Add an admin by the email of an existing HostKit account. */
export function AdminForm({
  handle,
  action,
}: {
  handle: string;
  action: (prev: ClubFormState, formData: FormData) => Promise<ClubFormState>;
}) {
  const [state, formAction] = useActionState<ClubFormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="handle" value={handle} />
      <Input name="email" type="email" required placeholder="their@email.edu" className="w-64" />
      <Submit />
      <FormError>{state?.error}</FormError>
    </form>
  );
}
