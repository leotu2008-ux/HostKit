"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { InquiryStatus } from "@/generated/prisma/enums";
import {
  deleteInquiryAction,
  startInquiryAction,
  updateInquiryAction,
} from "@/lib/actions/inquiries";
import { INQUIRY_STATUS_FLOW, INQUIRY_STATUS_LABEL } from "@/lib/catalog";
import { mailtoLink } from "@/lib/outreach";
import { formatCents } from "@/lib/money";
import {
  Button,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function StartInquiryButton({
  eventId,
  listingId,
}: {
  eventId: string;
  listingId: string;
}) {
  return (
    <form action={startInquiryAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="listingId" value={listingId} />
      <Submit label="Draft an inquiry" />
    </form>
  );
}

export function InquiryPanel({
  eventId,
  inquiry,
  subject,
}: {
  eventId: string;
  inquiry: {
    id: string;
    status: InquiryStatus;
    message: string;
    quotedCents: number | null;
    toEmail: string | null;
  };
  subject: string;
}) {
  const [state, formAction] = useActionState(updateInquiryAction, undefined);
  const [message, setMessage] = useState(inquiry.message);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the textarea is selectable regardless.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="inquiryId" value={inquiry.id} />
        <FormError>{state?.error}</FormError>

        <label className="block">
          <span className="text-[13px] font-medium text-ink-soft">Their email</span>
          <input
            type="email"
            name="toEmail"
            defaultValue={inquiry.toEmail ?? ""}
            placeholder="events@venue.com"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink"
          />
        </label>

        <Field
          label="Your message"
          hint="Already filled in with your date, headcount and hours."
        >
          <Textarea
            name="message"
            rows={12}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="font-mono text-[13px] leading-relaxed"
          />
        </Field>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className={cx(
              "h-10 flex-1 rounded-full border border-line-strong text-sm font-medium transition-colors",
              copied ? "border-forest bg-forest-wash text-forest" : "hover:bg-sunk",
            )}
          >
            {copied ? "Copied" : "Copy message"}
          </button>
          <a
            href={mailtoLink(subject, message)}
            className="flex h-10 flex-1 items-center justify-center rounded-full border border-line-strong text-sm font-medium hover:bg-sunk"
          >
            Open in email
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
          <Field label="Status">
            {/* Keyed on the server value: these are uncontrolled inputs, so
                without a remount they keep showing the pre-save status after
                the action lands and the panel silently lies about state. */}
            <Select
              key={inquiry.status}
              name="status"
              defaultValue={inquiry.status}
            >
              {INQUIRY_STATUS_FLOW.map((status) => (
                <option key={status} value={status}>
                  {INQUIRY_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Agreed price">
            <Input
              key={inquiry.quotedCents ?? "none"}
              name="quoted"
              inputMode="decimal"
              placeholder="0"
              defaultValue={
                inquiry.quotedCents
                  ? (inquiry.quotedCents / 100).toFixed(2).replace(/\.00$/, "")
                  : ""
              }
            />
          </Field>
        </div>

        <p className="text-sm text-ink-mute">
          Marking this booked adds{" "}
          {inquiry.quotedCents ? formatCents(inquiry.quotedCents) : "the price"}{" "}
          to your budget and ticks off the matching task.
        </p>

        <Submit label="Save" />
      </form>

      <form action={deleteInquiryAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="inquiryId" value={inquiry.id} />
        <button
          type="submit"
          className="w-full text-sm text-ink-mute hover:text-danger"
        >
          Delete this inquiry
        </button>
      </form>
    </div>
  );
}
