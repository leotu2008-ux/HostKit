"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  registerForEventAction,
  type RegisterState,
} from "@/lib/actions/register";
import { AddToCalendar, type CalendarLinks } from "@/components/add-to-calendar";
import { Button, ButtonLink, FormError } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Registering…" : label}
    </Button>
  );
}

/**
 * Registering needs an account, so the host's blasts have a real email to
 * go to. Signed out, this points at sign-in / sign-up and comes straight
 * back here afterwards. Once you're in, the calendar links are right there.
 */
export function RegisterForm({
  eventId,
  viewer,
  calendar,
}: {
  eventId: string;
  viewer: { name: string; email: string } | null;
  calendar: CalendarLinks | null;
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
          We’ll see you there. Updates from the host go to {viewer?.email}.
        </p>
        {calendar ? (
          <div className="mt-3 flex justify-center">
            <AddToCalendar links={calendar} />
          </div>
        ) : null}
      </div>
    );
  }

  if (!viewer) {
    const next = encodeURIComponent(`/e/${eventId}`);
    return (
      <div className="space-y-2">
        <ButtonLink href={`/signin?next=${next}`} size="lg" className="w-full">
          Sign in to register
        </ButtonLink>
        <ButtonLink href={`/signup?next=${next}`} variant="secondary" size="lg" className="w-full">
          Create an account
        </ButtonLink>
        <p className="pt-1 text-center text-[13px] text-ink-mute">
          Takes a minute. The host sends updates to the email you sign up with.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <Submit label={`Register as ${viewer.name}`} />
      <p className="text-center text-[13px] text-ink-mute">
        The host will see your name and email ({viewer.email}).
      </p>
    </form>
  );
}
