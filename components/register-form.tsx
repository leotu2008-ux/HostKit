"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  registerForEventAction,
  type RegisterState,
} from "@/lib/actions/register";
import { AddToCalendar, type CalendarLinks } from "@/components/add-to-calendar";
import { Button, ButtonLink, FormError } from "@/components/ui";

/** What pressing the button does: straight in, ask the host, or join the line. */
export type RegisterMode = "register" | "request" | "waitlist";

const LABEL: Record<RegisterMode, string> = {
  register: "Register",
  request: "Request to join",
  waitlist: "Join the waitlist",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

/**
 * Registering needs an account, so the host's blasts have a real email to
 * go to. Signed out, this points at sign-in / sign-up and comes straight
 * back here afterwards. The confirmation depends on where you landed:
 * in, waiting for the host, or on the waitlist.
 */
export function RegisterForm({
  eventId,
  viewer,
  calendar,
  mode = "register",
  started = false,
}: {
  eventId: string;
  viewer: { name: string; email: string } | null;
  calendar: CalendarLinks | null;
  mode?: RegisterMode;
  /** The night has begun: the line no longer moves by itself. */
  started?: boolean;
}) {
  const [state, formAction] = useActionState(
    registerForEventAction,
    undefined as RegisterState,
  );

  if (state?.ok) {
    if (state.state === "pending") {
      return (
        <div className="rounded-card bg-amber-wash px-4 py-4 text-center">
          <p className="font-display text-lg text-ink">Request sent</p>
          <p className="mt-1 text-sm text-ink-soft">
            The host confirms each guest. You’ll hear at {viewer?.email} once they do.
          </p>
        </div>
      );
    }
    if (state.state === "waitlisted") {
      return (
        <div className="rounded-card bg-amber-wash px-4 py-4 text-center">
          <p className="font-display text-lg text-ink">You’re on the waitlist</p>
          <p className="mt-1 text-sm text-ink-soft">
            {started
              ? `If a spot opens the host can let you in — we’ll tell you at ${viewer?.email}.`
              : `If a spot opens you’re in automatically — we’ll tell you at ${viewer?.email}.`}
          </p>
        </div>
      );
    }
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
          Sign in to {mode === "register" ? "register" : mode === "request" ? "request a spot" : "join the waitlist"}
        </ButtonLink>
        <ButtonLink href={`/signup?next=${next}`} variant="secondary" size="lg" className="w-full">
          Join the waitlist
        </ButtonLink>
        <p className="pt-1 text-center text-[13px] text-ink-mute">
          We’ll add your email to the waitlist and keep you posted.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <Submit label={mode === "register" ? `Register as ${viewer.name}` : LABEL[mode]} />
      <p className="text-center text-[13px] text-ink-mute">
        {mode === "request"
          ? `The host approves each guest. They’ll see your name and email (${viewer.email}).`
          : mode === "waitlist"
            ? started
              ? "The host can let you in if a spot opens."
              : "You’ll be let in automatically when a spot opens."
            : `The host will see your name and email (${viewer.email}).`}
      </p>
    </form>
  );
}
