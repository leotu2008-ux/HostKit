"use client";

import Link from "next/link";
import { useState } from "react";
import type { OutreachRow } from "@/lib/api/outreach";
import { mailtoLink } from "@/lib/outreach";
import {
  removeCollaboratorAction,
  setCollaboratorStatusAction,
} from "@/lib/actions/collaborators";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, Textarea, buttonClass, type Tone } from "@/components/ui";

const STATUS: Record<OutreachRow["status"], { label: string; tone: Tone }> = {
  PENDING: { label: "Not yet asked", tone: "neutral" },
  SENT: { label: "Asked", tone: "amber" },
  REPLIED: { label: "Replied", tone: "amber" },
  QUOTED: { label: "Quoted", tone: "clay" },
  CONFIRMED: { label: "Confirmed", tone: "forest" },
  BOOKED: { label: "Booked", tone: "forest" },
  DECLINED: { label: "Declined", tone: "danger" },
};

/** One person or place to reach, with the drafted first message ready. */
export function OutreachCard({ row, eventId }: { row: OutreachRow; eventId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(row.message);
  const status = STATUS[row.status];
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
          </div>
        </div>
      ) : null}
    </Card>
  );
}
