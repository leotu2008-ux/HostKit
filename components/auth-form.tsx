"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "@/lib/actions/auth";
import { Button, Field, FormError, Input } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  includeName,
}: {
  action: (
    state: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>;
  submitLabel: string;
  includeName?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state?.error}</FormError>
      {includeName ? (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        hint={includeName ? "At least 8 characters." : undefined}
      >
        <Input
          name="password"
          type="password"
          autoComplete={includeName ? "new-password" : "current-password"}
          required
        />
      </Field>
      <Submit label={submitLabel} />
    </form>
  );
}
