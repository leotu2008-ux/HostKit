"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "@/lib/actions/auth";
import Link from "next/link";
import { Button, Field, FormError, Input } from "@/components/ui";
import { ResendVerificationForm } from "@/components/account-forms";
import { publishWaitlistCount } from "@/components/waitlist-count";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

/** A password box with a show/hide switch — typos are the usual sign-in failure. */
function PasswordField({
  label,
  hint,
  autoComplete,
  minLength,
  trailing,
}: {
  label: string;
  hint?: string;
  autoComplete: string;
  minLength?: number;
  trailing?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          name="password"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="pr-16"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-[12px] font-medium text-ink-soft hover:bg-sunk hover:text-ink"
          aria-pressed={shown}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {trailing}
    </Field>
  );
}

export function AuthForm({
  action,
  submitLabel,
  includeName,
  includePassword = true,
  next,
  publish,
  email,
}: {
  action: (
    state: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>;
  submitLabel: string;
  includeName?: boolean;
  /** Signup for the email list does not ask for a password. */
  includePassword?: boolean;
  next?: string;
  publish?: boolean;
  /** Prefilled after confirming an address or resetting a password. */
  email?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const joinedCount = state?.listed?.waitlistCount;

  // Joining changes the number under "Join the waitlist": pass it on, so the
  // landing page shows it on the way back without waiting on the server.
  useEffect(() => {
    publishWaitlistCount(joinedCount);
  }, [joinedCount]);

  // Joined the list. No account was created.
  if (state?.listed) {
    return (
      <div className="rounded-lg bg-forest-wash px-3 py-3 text-sm text-forest" role="status">
        <p className="font-medium">Thanks for joining the waitlist!</p>
        <p className="mt-0.5">We’ll keep you posted whenever updates happen.</p>
        <p className="mt-0.5">
          A confirmation is on its way to <span className="font-medium">{state.listed.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {publish ? <input type="hidden" name="publish" value="1" /> : null}
      <FormError>{state?.error}</FormError>
      {state?.unverifiedEmail ? <ResendVerificationForm email={state.unverifiedEmail} /> : null}
      {includeName ? (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required autoFocus />
        </Field>
      ) : null}
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email ?? ""}
          autoFocus={!includeName && !email}
        />
      </Field>
      {includePassword ? (
        <PasswordField
          label="Password"
          hint={includeName ? "At least 8 characters." : undefined}
          autoComplete={includeName ? "new-password" : "current-password"}
          minLength={includeName ? 8 : undefined}
          trailing={
            includeName ? null : (
              <p className="mt-1.5 text-right text-[13px]">
                <Link href="/forgot-password" className="text-ink-soft hover:text-ink hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )
          }
        />
      ) : null}
      <Submit label={submitLabel} />
    </form>
  );
}
