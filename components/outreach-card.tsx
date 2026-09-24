"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { OutreachRow } from "@/lib/api/outreach";
import { mailtoLink } from "@/lib/outreach";
import {
  removeCollaboratorAction,
  saveCollaboratorMessageAction,
  sendCollaboratorAction,
  setCollaboratorStatusAction,
} from "@/lib/actions/collaborators";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, Field, Input, Textarea, buttonClass, type Tone } from "@/components/ui";

const STATUS: Record<OutreachRow["status"], { label: string; tone: Tone }> = {
  PENDING: { label: "Not yet asked", tone: "neutral" },
  SENT: { label: "Asked", tone: "amber" },
  REPLIED: { label: "Replied", tone: "amber" },
  QUOTED: { label: "Quoted", tone: "clay" },
  CONFIRMED: { label: "Confirmed", tone: "forest" },
  BOOKED: { label: "Booked", tone: "forest" },
  DECLINED: { label: "Declined", tone: "danger" },
};

/** Disabled while pending (a second click would be a second email to a real
 *  person) and while the message has unsaved edits — sendCollaboratorAction
 *  mails the row saved in the database, not whatever is on screen, so a
 *  dirty textarea must not be sendable. Copied from the SendButton in
 *  components/inquiry-panel.tsx. */
function SendButton({ dirty, name }: { dirty: boolean; name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || dirty}
      className="h-9 rounded-full bg-clay px-4 text-sm font-medium text-on-clay hover:bg-clay-deep disabled:opacity-50"
    >
      {pending ? "Sending…" : dirty ? "Save your changes first" : `Send to ${name}`}
    </button>
  );
}

/** One person or place to reach, with the drafted first message ready. */
export function OutreachCard({ row, eventId }: { row: OutreachRow; eventId: string }) {
  // A draft that hasn't gone out starts open, so after a run the host reads
  // down the page and sends each one. Still one press per send.
  const [open, setOpen] = useState(row.status === "PENDING" && !row.sentAt);
  const [message, setMessage] = useState(row.message);
  const [email, setEmail] = useState(row.email ?? "");
  // Resync whenever the server's copy changes, the React-recommended way to
  // reset state on a prop change (setState during render, not in an effect —
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // A successful save calls refresh() (lib/actions/collaborators.ts), which
  // re-renders this card with a new row.message/row.email; without this the
  // fields would keep showing exactly what was just saved as though still
  // unsaved (or, after another tab's edit, a stale value).
  const [syncedMessage, setSyncedMessage] = useState(row.message);
  const [syncedEmail, setSyncedEmail] = useState(row.email ?? "");
  if (row.message !== syncedMessage) {
    setSyncedMessage(row.message);
    setMessage(row.message);
  }
  if ((row.email ?? "") !== syncedEmail) {
    setSyncedEmail(row.email ?? "");
    setEmail(row.email ?? "");
  }
  // sendCollaboratorAction mails collaborator.email/collaborator.message from
  // the database, so an edit to either one that hasn't been saved yet must
  // block sending, not just an edited message.
  const dirty = message !== row.message || email !== (row.email ?? "");
  const [sendState, sendAction] = useActionState(sendCollaboratorAction, undefined);
  const [saveState, saveAction] = useActionState(saveCollaboratorMessageAction, undefined);
  const asked = row.source === "collaborator" && row.status === "PENDING" && Boolean(row.sentAt);
  const status = asked ? { label: "Asked", tone: "amber" as Tone } : STATUS[row.status];
  const contactBits = [
    row.email ? { label: row.email, href: mailtoLink(row.subject, message).replace("mailto:?", `mailto:${row.email}?`) } : null,
    row.phone ? { label: row.phone, href: `tel:${row.phone.replace(/[^\d+]/g, "")}` } : null,
    row.website ? { label: row.website.replace(/^https?:\/\//, ""), href: row.website } : null,
  ].filter((b): b is { label: string; href: string } => b !== null);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{row.name}</p>
          {row.detail ? <p className="text-[13px] text-ink-soft">{row.detail}</p> : null}
          {contactBits.length > 0 ? (
            <p className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
              {contactBits.map((bit) => (
                <a key={bit.href} href={bit.href} className="text-clay hover:underline" target={bit.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  {bit.label}
                </a>
              ))}
            </p>
          ) : row.source === "collaborator" ? (
            <p className="mt-1 text-[13px] text-ink-mute">No contact details yet — add them, or search the web for {row.name}.</p>
          ) : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass("secondary", "sm")}>
          {open ? "Hide message" : "Draft message"}
        </button>
        {row.source === "inquiry" && row.listingPath ? (
          <Link href={row.listingPath} className={buttonClass("ghost", "sm")}>
            Open listing
          </Link>
        ) : null}
        {row.source === "collaborator" ? (
          <>
            <form action={setCollaboratorStatusAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="collaboratorId" value={row.id} />
              {row.status === "CONFIRMED" ? (
                <button name="status" value="PENDING" className={buttonClass("ghost", "sm")}>
                  Mark pending
                </button>
              ) : (
                <button name="status" value="CONFIRMED" className={buttonClass("ghost", "sm")}>
                  Mark confirmed
                </button>
              )}
            </form>
            <form action={removeCollaboratorAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="collaboratorId" value={row.id} />
              <button type="submit" className={buttonClass("ghost", "sm", "text-ink-mute hover:text-danger")}>
                Remove
              </button>
            </form>
          </>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-[13px] text-ink-mute">
            Subject: <span className="text-ink">{row.subject}</span>
          </p>
          {row.source === "collaborator" ? (
            // Apple Maps (Milestone C) never returns an email — see
            // lib/venues/apple-maps.ts — so for every venue it finds, this is
            // the only place the host can supply one. Without it, canSend
            // (lib/api/outreach.ts) never turns true and the send form below
            // never appears. `form` associates this input with the save
            // <form> further down without nesting it inside — the same HTML
            // trick the send form's separateness already relies on not
            // needing, since this one genuinely has to sit before the
            // textarea for a sane tab order.
            <Field label="Their email">
              <Input
                type="email"
                name="email"
                form={`save-outreach-${row.id}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="events@venue.com"
              />
            </Field>
          ) : null}
          <Textarea
            rows={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="font-mono text-[13px] leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={message} label="Copy message" />
            <a
              href={row.email ? mailtoLink(row.subject, message).replace("mailto:?", `mailto:${row.email}?`) : mailtoLink(row.subject, message)}
              className={buttonClass("secondary", "sm")}
            >
              Open in email
            </a>
            {row.source === "collaborator" ? (
              <form id={`save-outreach-${row.id}`} action={saveAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="collaboratorId" value={row.id} />
                <input type="hidden" name="message" value={message} />
                <button type="submit" disabled={!dirty} className={buttonClass("secondary", "sm")}>
                  Save message
                </button>
              </form>
            ) : null}
          </div>
          {saveState?.error ? <p className="text-[13px] text-danger">{saveState.error}</p> : null}

          {/* Its own form: nested forms are invalid HTML, and a send must
              not also submit the save form above. Only offered once there is
              somewhere to send it and it hasn't already gone out — once
              row.canSend flips false the "Asked"/status badge above is the
              only word on it. */}
          {row.source === "collaborator" && row.canSend ? (
            <form action={sendAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="collaboratorId" value={row.id} />
              <SendButton dirty={dirty} name={row.name} />
            </form>
          ) : null}
          {sendState?.error ? <p className="text-[13px] text-danger">{sendState.error}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
