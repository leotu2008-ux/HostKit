"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  registerForEventAction,
  type RegisterState,
} from "@/lib/actions/register";
import { Button, Field, FormError, Input } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Registering…" : label}
    </Button>
  );
}

export function RegisterForm({
  eventId,
  defaultName,
  defaultEmail,
}: {
  eventId: string;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, formAction] = useActionState(
    registerForEventAction,
    undefined as RegisterState,
  );

  if (state?.ok) {
    return (
      <div className="rounded-card bg-forest-wash px-4 py-4 text-center">
        <p className="font-display text-lg text-forest">You’re in</p>
        <p className="mt-1 text-sm text-ink-soft">
          We’ll see you there. Add the night to your calendar however you like.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <Field label="Name">
        <Input
          name="name"
          required
          autoComplete="name"
          defaultValue={defaultName}
        />
      </Field>
      <Field label="Email">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
        />
      </Field>
      <Submit label="Register" />
    </form>
  );
}
