"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resendVerificationToAction,
  resetPasswordAction,
  type AccountFormState,
} from "@/lib/actions/account";
import { Button, Field, FormError, Input } from "@/components/ui";

function Submit({ label, size = "lg" }: { label: string; size?: "sm" | "md" | "lg" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} className={size === "lg" ? "w-full" : undefined} disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

/** Shown in development when no email service is configured: the link itself. */
export function DevLink({ link }: { link?: string }) {
  if (!link) return null;
  return (
    <p className="rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber">
      No email service is configured, so here’s the link:{" "}
      <a href={link} className="underline">
        open it
      </a>
      .
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AccountFormState, FormData>(forgotPasswordAction, undefined);
  if (state?.sent) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">
          If that address has an account, a reset link is on its way. It works for an hour.
        </p>
        <DevLink link={state.devLink} />
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state?.error}</FormError>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Submit label="Send reset link" />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(resetPasswordAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError>{state?.error}</FormError>
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Again, to be sure">
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Submit label="Set new password" />
    </form>
  );
}

/**
 * "Resend the confirmation link" for an address that can’t sign in yet —
 * after sign-up, on a refused sign-in, on /check-email. With `email` the
 * address is fixed; without it the person types it. Always says "sent".
 */
export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(resendVerificationToAction, undefined);
  if (state?.sent) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">
          If that address has an unconfirmed account, a fresh link is on its way. It works for a day.
        </p>
        <DevLink link={state.devLink} />
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state?.error}</FormError>
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
      )}
      <Submit label="Resend the link" size={email ? "sm" : "lg"} />
    </form>
  );
}

/** The "verify your email" nudge on the profile, with a resend button. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(resendVerificationAction, undefined);
  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-4">
      <p className="font-medium text-ink">Confirm your email</p>
      <p className="mt-0.5 text-[14px] text-ink-soft">
        We sent a link to <span className="font-medium text-ink">{email}</span>. Opening it keeps your account
        recoverable.
      </p>
      <form action={formAction} className="mt-3 space-y-2">
        <FormError>{state?.error}</FormError>
        {state?.sent ? (
          <p className="text-[13px] text-forest">Sent again — check your inbox.</p>
        ) : (
          <Submit label="Resend the link" size="sm" />
        )}
        <DevLink link={state?.devLink} />
      </form>
    </div>
  );
}
