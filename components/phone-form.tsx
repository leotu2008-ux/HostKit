"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { phoneAction, type PhoneFormState } from "@/lib/actions/phone";
import { formatPhone } from "@/lib/phone";
import { Badge, Button, Field, FormError, Input } from "@/components/ui";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

/**
 * Two steps: a number, then the code that was texted to it. When the server
 * has no SMS service it hands the code back (development only) and it's
 * shown inline so the flow can still be walked.
 */
export function PhoneForm({ phone, verified }: { phone: string | null; verified: boolean }) {
  const [state, formAction] = useActionState<PhoneFormState, FormData>(phoneAction, undefined);

  if (state?.step === "code") {
    return (
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="intent" value="verify" />
        <FormError>{state.error}</FormError>
        <p className="text-[15px] text-ink-soft">
          We texted a 6-digit code to <span className="font-medium text-ink">{formatPhone(state.phone)}</span>.
        </p>
        {state.devCode ? (
          <p className="rounded-lg bg-amber-wash px-3 py-2 text-sm text-ink">
            No SMS service on this server — your code is <span className="font-mono font-semibold">{state.devCode}</span>.
          </p>
        ) : null}
        <Field label="Code">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="w-40 tracking-[0.3em]"
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Submit>Verify</Submit>
          <Button
            type="submit"
            variant="ghost"
            formAction={(fd) => {
              fd.set("intent", "start");
              fd.set("phone", state.phone);
              return formAction(fd);
            }}
          >
            Send again
          </Button>
        </div>
      </form>
    );
  }

  if ((phone && verified && state?.step !== "number") || state?.step === "done") {
    return (
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="intent" value="remove" />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-ink">{formatPhone(phone ?? "")}</p>
          <Badge tone="forest">Verified</Badge>
        </div>
        <p className="text-[13px] text-ink-mute">
          Hosts of events you register for can see this number.
        </p>
        <Button type="submit" variant="ghost" size="sm">
          Remove number
        </Button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="intent" value="start" />
      <FormError>{state?.error}</FormError>
      <Field label="Mobile number" hint="We’ll text you a code to confirm it.">
        <Input name="phone" type="tel" autoComplete="tel" placeholder="(617) 555-0100" required className="w-64" />
      </Field>
      <Submit>Text me a code</Submit>
    </form>
  );
}
