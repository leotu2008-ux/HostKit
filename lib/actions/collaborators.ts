"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import type { CollaboratorKind, CollaboratorStatus } from "@/generated/prisma/enums";
import { composeInquiry, inquiryEmail, normalizeRecipient } from "@/lib/outreach";
import { isEmailConfigured, sendEmails } from "@/lib/email/send";
import { EmailSendError } from "@/lib/email/failure";
import { LIMITS, RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { record } from "@/lib/activity";

const KINDS = ["VENUE", "SPEAKER", "COHOST"] as const;
const STATUSES = ["PENDING", "CONFIRMED", "DECLINED"] as const;

/** Readable labels for the outreach kinds, matching the section titles on
 *  the Outreach page (app/(app)/events/[id]/(outreach)/outreach/page.tsx). */
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  VENUE: "Venue",
  SPEAKER: "Speaker",
  COHOST: "Cohost",
};

const addSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(KINDS),
  name: z.string().trim().min(1, "Add a name.").max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(200).optional(),
});

export type CollaboratorFormState = { error?: string } | undefined;

export async function addCollaboratorAction(
  _prev: CollaboratorFormState,
  formData: FormData,
): Promise<CollaboratorFormState> {
  const parsed = addSchema.safeParse({
    eventId: formData.get("eventId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    detail: formData.get("detail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await requireEvent(parsed.data.eventId);
  await db.eventCollaborator.create({
    data: {
      eventId: parsed.data.eventId,
      kind: parsed.data.kind as CollaboratorKind,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      detail: parsed.data.detail || null,
    },
  });
  refresh();
  return undefined;
}

export async function setCollaboratorStatusAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  await requireEvent(eventId);

  const before = await db.eventCollaborator.findFirst({
    where: { id: collaboratorId, eventId },
    select: { kind: true, name: true, status: true },
  });
  await db.eventCollaborator.updateMany({
    where: { id: collaboratorId, eventId },
    data: { status: status as CollaboratorStatus },
  });
  // Only the move into CONFIRMED is worth a line — re-picking the same
  // status isn't new news.
  if (before && status === "CONFIRMED" && before.status !== "CONFIRMED") {
    await record(eventId, {
      actor: "host",
      kind: "collaborator_confirmed",
      title: `${KIND_LABEL[before.kind]} confirmed: ${before.name}`,
    });
  }
  refresh();
}

export async function removeCollaboratorAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  await requireEvent(eventId);
  await db.eventCollaborator.deleteMany({
    where: { id: collaboratorId, eventId },
  });
  refresh();
}

export type SaveCollaboratorMessageState = { error?: string } | undefined;

/**
 * Saves what the host edited before sending: the contact's address and/or
 * the outreach message. sendCollaboratorAction always mails what is stored
 * here, never whatever happens to be sitting in the textarea — see the dirty
 * guard on the send form in components/outreach-card.tsx.
 */
export async function saveCollaboratorMessageAction(
  _prev: SaveCollaboratorMessageState,
  formData: FormData,
): Promise<SaveCollaboratorMessageState> {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  await requireEvent(eventId);

  const rawEmail = String(formData.get("email") ?? "").trim();
  let email: string | null = null;
  if (rawEmail) {
    email = normalizeRecipient(rawEmail);
    if (!email) return { error: "That doesn't look like an email address." };
  }

  // Empty clears back to the composeInquiry draft, the same way email above
  // clears back to "no address yet" — an empty save is "undo my edit", not
  // "send nothing".
  const rawMessage = String(formData.get("message") ?? "");
  const message = rawMessage.trim().length > 0 ? rawMessage : null;

  await db.eventCollaborator.updateMany({
    where: { id: collaboratorId, eventId },
    data: { email, message },
  });
  refresh();
  return undefined;
}

export type SendCollaboratorFormState = { error?: string } | undefined;

/**
 * Sends the drafted (or edited) message to one collaborator — venue,
 * speaker or cohost. The line-for-line sibling of sendInquiryAction
 * (lib/actions/inquiries.ts:220), which until now was the only tracked send
 * loop; collaborators had nothing beyond mailto/copy in outreach-card.
 *
 * Deliberately per-contact, not a batch, for the same reason sendInquiryAction
 * is: this mails a real person with the host's name on it, and the approval
 * is per message.
 */
export async function sendCollaboratorAction(
  _prev: SendCollaboratorFormState,
  formData: FormData,
): Promise<SendCollaboratorFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const { event, user } = await requireEvent(eventId);

  // requireEvent admits a signed-out visitor holding a draft-claim cookie
  // (lib/session.ts:67). This action, like sendInquiryAction, chooses both
  // recipient and body, so it refuses harder than requireEvent alone does:
  // an anonymous send would leave from HostKit's own domain with no reply
  // address on it.
  if (!user?.email) {
    return { error: "Sign in before sending this." };
  }

  try {
    // Same bucket as sendInquiryAction — one host, one hourly allowance for
    // outbound mail, whichever kind of contact it goes to.
    await assertRateLimit(`outreach:${user.id}`, ...LIMITS.outreach.perActor);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet, so nothing can be sent from here." };
  }

  const collaborator = await db.eventCollaborator.findFirst({
    where: { id: collaboratorId, eventId },
  });
  if (!collaborator) return { error: "That contact is no longer here." };

  const to = normalizeRecipient(collaborator.email);
  if (!to) return { error: "Add their email address first." };

  const { subject, body: draft } = composeInquiry(
    event,
    { name: collaborator.name, role: collaborator.kind },
    user.name ?? "the host",
  );
  const message = collaborator.message ?? draft;

  // Claim the row before sending, not after — same reasoning as
  // sendInquiryAction: two tabs (or a fast double-click that beats
  // disabled={pending}) can both read sentAt: null and both pass every check
  // above, but only one updateMany can match this where clause. Whoever
  // loses the claim never sends.
  const claimed = await db.eventCollaborator.updateMany({
    where: { id: collaborator.id, eventId, sentAt: null },
    data: { sentAt: new Date() },
  });
  if (claimed.count === 0) {
    return { error: "That message has already been sent." };
  }

  try {
    await sendEmails([inquiryEmail({ to, subject, message, hostEmail: user.email })]);
  } catch (error) {
    // Say which end failed, the way sendInquiryAction and lib/email/failure.ts
    // do elsewhere: a host who cannot tell "your sender isn't verified" from
    // "that address bounced" will retry the wrong one forever.
    const failure = error instanceof EmailSendError ? error.cause : "unknown";

    if (failure === "sender" || failure === "recipient") {
      // The provider explicitly rejected this one — nothing left the
      // building — so it is both safe and necessary to undo the claim and
      // let the host fix it and resend.
      await db.eventCollaborator.updateMany({
        where: { id: collaborator.id, eventId },
        data: { sentAt: null },
      });
      return {
        error:
          failure === "recipient"
            ? "That address bounced. Check it and try again."
            : "The message couldn't be sent. Nothing was delivered.",
      };
    }

    // "unknown" is exactly the class where the provider may have already
    // accepted the message and the response was lost — a fetch timeout
    // throws a plain TypeError here, not an EmailSendError. Reverting sentAt
    // would invite a retry that mails the contact twice, so the row stays
    // claimed and we say we're not sure, rather than claim nothing went out.
    return {
      error: "We couldn't confirm that went out.",
    };
  }

  await record(eventId, {
    actor: "host",
    kind: "collaborator_sent",
    title: `Emailed ${collaborator.name}`,
    href: `/events/${eventId}/outreach`,
  });

  refresh();
  return undefined;
}
