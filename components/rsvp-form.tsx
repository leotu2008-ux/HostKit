"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RsvpStatus } from "@/generated/prisma/enums";
import { submitRsvpAction, type GuestFormState } from "@/lib/actions/guests";
import {
  Button,
  Field,
  FormError,
  Input,
  Textarea,
  cx,
} from "@/components/ui";

const CHOICES: Array<{ value: RsvpStatus; label: string }> = [
  { value: "ATTENDING", label: "Yes, I'll be there" },
  { value: "MAYBE", label: "Maybe" },
  { value: "DECLINED", label: "Sorry, can't make it" },
];

function Submit({ hasReplied }: { hasReplied: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Sending…" : hasReplied ? "Update my reply" : "Send my reply"}
    </Button>
  );
}

export function RsvpForm({
  token,
  current,
  plusOnes,
  dietary,
  allowPlusOnes,
  started = false,
}: {
  token: string;
  current: RsvpStatus;
  plusOnes: number;
  dietary: string | null;
  allowPlusOnes: boolean;
  /** The night has begun: the line no longer moves by itself. */
  started?: boolean;
}) {
  const [state, formAction] = useActionState<GuestFormState, FormData>(
    submitRsvpAction,
    undefined,
  );
  // Waiting on the host (a request, or the waitlist): the only move from
  // here is to step back — the host, or the line, lets people in.
  const waiting = current === "PENDING" || current === "WAITLISTED";
  const choices = waiting ? CHOICES.filter((c) => c.value === "DECLINED") : CHOICES;
  const [choice, setChoice] = useState<RsvpStatus>(
    current === "INVITED" ? "ATTENDING" : waiting ? "DECLINED" : current,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rsvpStatus" value={choice} />
      <FormError>{state?.error}</FormError>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">
          {waiting
            ? current === "PENDING"
              ? "Your request is with the host"
              : "You're on the waitlist"
            : "Can you make it?"}
        </legend>
        {waiting ? (
          <p className="mb-3 text-[13px] text-ink-mute">
            {current === "PENDING"
              ? "They'll confirm your spot. Changed your mind?"
              : started
                ? "The host can let you in if a spot opens. Changed your mind?"
                : "You'll be let in automatically when a spot opens. Changed your mind?"}
          </p>
        ) : null}
        <div className="space-y-2">
          {choices.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setChoice(option.value)}
              aria-pressed={choice === option.value}
              className={cx(
                "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                choice === option.value
                  ? "border-clay bg-clay-wash font-medium text-clay-deep"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Only an attending guest brings anyone with them. */}
      {choice === "ATTENDING" && allowPlusOnes ? (
        <Field label="Bringing anyone?" hint="How many extra people, if any.">
          <Input
            name="plusOnes"
            type="number"
            min={0}
            max={20}
            defaultValue={plusOnes}
          />
        </Field>
      ) : (
        <input type="hidden" name="plusOnes" value={0} />
      )}

      {choice !== "DECLINED" ? (
        <Field
          label="Anything we should know?"
          hint="Allergies, dietary requirements, access needs."
        >
          <Textarea name="dietary" rows={3} defaultValue={dietary ?? ""} />
        </Field>
      ) : null}

      <Submit hasReplied={current !== "INVITED"} />
    </form>
  );
}
