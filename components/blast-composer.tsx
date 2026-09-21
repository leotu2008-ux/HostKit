"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendBlastAction, type BlastFormState } from "@/lib/actions/blasts";
import { SEGMENTS, type Segment } from "@/lib/blasts";
import { CopyButton } from "@/components/copy-button";
import { Button, Field, FormError, Input, Textarea, cx } from "@/components/ui";

function Submit({ canSend }: { canSend: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : canSend ? "Send" : "Record and copy"}
    </Button>
  );
}

/**
 * Write one message to a slice of the guest list. With email configured it
 * goes out; otherwise HostKit records it and hands over the recipients to
 * paste into whatever the host uses. With Twilio configured, guests with a
 * verified phone can be texted too.
 */
export function BlastComposer({
  eventId,
  eventTitle,
  counts,
  phoneCounts,
  canSend,
  canText,
}: {
  eventId: string;
  eventTitle: string;
  counts: Record<Segment, number>;
  phoneCounts?: Record<Segment, number>;
  canSend: boolean;
  canText?: boolean;
}) {
  const [state, formAction] = useActionState<BlastFormState, FormData>(sendBlastAction, undefined);
  const [segment, setSegment] = useState<Segment>("going");
  const [subject, setSubject] = useState(`${eventTitle}: an update`);
  const [body, setBody] = useState("Hi {name},\n\n");
  const phones = phoneCounts?.[segment] ?? 0;

  if (state?.sent) {
    const { provider, count, emails, smsCount } = state.sent;
    return (
      <div className="space-y-4 rounded-xl border border-line bg-forest-wash/60 p-5">
        <p className="text-[15px] font-semibold text-forest">
          {provider === "resend"
            ? `Sent to ${count} ${count === 1 ? "guest" : "guests"}.`
            : `Recorded for ${count} ${count === 1 ? "guest" : "guests"}.`}
          {smsCount > 0 ? ` Texted ${smsCount}.` : ""}
        </p>
        {provider === "manual" ? (
          <>
            <p className="text-[14px] text-ink-soft">
              Email sending isn’t set up on this server. Copy the recipients and the
              message into your own email.
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={emails.join(", ")} label={`Copy ${count} addresses`} />
              <CopyButton text={body} label="Copy message" />
              <a
                href={`mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-3.5 text-sm font-medium text-ink"
              >
                Open in email
              </a>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="segment" value={segment} />
      <FormError>{state?.error}</FormError>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">To</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SEGMENTS) as Segment[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={segment === key}
              onClick={() => setSegment(key)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                segment === key
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong",
              )}
            >
              {SEGMENTS[key]} · {counts[key]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Subject">
        <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required />
      </Field>
      <Field label="Message" hint="{name} becomes each guest’s first name.">
        <Textarea name="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
      </Field>

      {canText ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="sms" disabled={phones === 0} className="h-4 w-4 accent-clay" />
          Also text {phones} {phones === 1 ? "guest" : "guests"} with a verified phone
        </label>
      ) : null}

      {!canSend ? (
        <p className="rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber">
          Email sending isn’t set up on this server (no RESEND_API_KEY). You’ll get the
          recipients to copy instead.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Submit canSend={canSend} />
        <span className="text-[13px] text-ink-mute">
          {counts[segment]} {counts[segment] === 1 ? "recipient" : "recipients"}
        </span>
      </div>
    </form>
  );
}
