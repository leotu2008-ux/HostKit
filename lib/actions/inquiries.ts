"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { formatCents, parseCents } from "@/lib/money";
import { composeInquiry, inquiryEmail, normalizeRecipient } from "@/lib/outreach";
import { isEmailConfigured, sendEmails } from "@/lib/email/send";
import { EmailSendError } from "@/lib/email/failure";
import { LIMITS, RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { record } from "@/lib/activity";

export type InquiryFormState = { error?: string } | undefined;

const STATUSES: InquiryStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "QUOTED",
  "BOOKED",
  "DECLINED",
];

/**
 * Opens the inquiry for a listing with the outreach message pre-drafted, and
 * shortlists it — enquiring is a strong signal of intent. Shared by the host's
 * own "inquire" button below and the agent's vendor step
 * (lib/agent/vendor-step.ts).
 *
 * Idempotent per (event, listing): a second call reopens the same thread
 * rather than starting a second one, and `update: {}` means it never
 * overwrites a message the host has since edited. Status is DRAFT and stays
 * DRAFT — this writes a draft, it does not mail anybody.
 */
export async function draftInquiry(eventId: string, listingId: string, message: string) {
  await db.inquiry.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId, message, status: "DRAFT" },
    update: {},
  });

  await db.savedListing.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId },
    update: {},
  });
}

/** The host pressing "inquire" on a listing they found themselves. */
export async function startInquiryAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const { event, user } = await requireEvent(eventId);

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return;

  const { body } = composeInquiry(event, listing, user?.name ?? "the host");
  await draftInquiry(eventId, listingId, body);
  refresh();
}

const updateSchema = z.object({
  status: z.enum(STATUSES as [string, ...string[]]),
  quoted: z.string().optional(),
  message: z.string().max(8000).optional(),
  toEmail: z.string().max(320).optional(),
});

/**
 * Moves an inquiry along, and — on BOOKED — writes the commitment back into
 * the budget and closes the matching timeline task.
 *
 * That write-back is the whole reason these things live in one app. Booking a
 * caterer in a vacuum is a note in a spreadsheet; booking one here moves the
 * budget and ticks the plan.
 */
export async function updateInquiryAction(
  _prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  await requireEvent(eventId);

  const parsed = updateSchema.safeParse({
    status: formData.get("status"),
    quoted: formData.get("quoted") ?? undefined,
    message: formData.get("message") ?? undefined,
    toEmail: formData.get("toEmail") ?? undefined,
  });
  if (!parsed.success) return { error: "That status isn't valid." };

  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, eventId },
    include: { listing: true },
  });
  if (!inquiry) return { error: "That inquiry no longer exists." };

  const status = parsed.data.status as InquiryStatus;

  let quotedCents: number | null = inquiry.quotedCents;
  const rawQuote = parsed.data.quoted?.trim();
  if (rawQuote) {
    const parsedQuote = parseCents(rawQuote);
    if (parsedQuote === null) return { error: "That price doesn't look right." };
    quotedCents = parsedQuote;
  }

  // Booking without a price would put a zero into the budget and quietly
  // understate what the event costs.
  if (status === "BOOKED" && (quotedCents === null || quotedCents === 0)) {
    return { error: "Add the agreed price before marking this booked." };
  }

  // Absent field: leave toEmail alone (undefined below). Empty field: the
  // host cleared it, deliberately — write null. Non-empty field that zod's
  // email check rejects (e.g. "events@venue", no dot — type="email" does not
  // catch that): refuse the save rather than silently discarding it, or the
  // field would keep showing the text the host typed while nothing was
  // actually stored.
  let nextToEmail: string | null | undefined;
  if (formData.has("toEmail")) {
    const raw = parsed.data.toEmail?.trim() ?? "";
    if (!raw) {
      nextToEmail = null;
    } else {
      const normalized = normalizeRecipient(parsed.data.toEmail);
      if (!normalized) return { error: "That email address doesn't look right." };
      nextToEmail = normalized;
    }
  }

  await db.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status,
        quotedCents,
        message: parsed.data.message ?? inquiry.message,
        // Only touch toEmail when the form actually carried the field: an
        // absent field means "leave it alone," an empty one means "clear
        // it." Writing the key unconditionally would let any future caller
        // of this action that doesn't post toEmail silently erase a stored
        // address. See nextToEmail above for the invalid-address case.
        ...(nextToEmail !== undefined ? { toEmail: nextToEmail } : {}),
        sentAt:
          status !== "DRAFT" && !inquiry.sentAt ? new Date() : inquiry.sentAt,
        respondedAt:
          ["REPLIED", "QUOTED", "BOOKED", "DECLINED"].includes(status) &&
          !inquiry.respondedAt
            ? new Date()
            : inquiry.respondedAt,
      },
    });

    if (status === "BOOKED") {
      const category = await tx.budgetCategory.findUnique({
        where: {
          eventId_category: { eventId, category: inquiry.listing.category },
        },
      });

      if (category) {
        // inquiryId is unique on BudgetItem, so re-booking at a corrected
        // price updates the same line rather than double-counting it.
        const existing = await tx.budgetItem.findUnique({
          where: { inquiryId: inquiry.id },
        });
        const data = {
          eventId,
          categoryId: category.id,
          label: inquiry.listing.name,
          estimatedCents: quotedCents!,
          actualCents: quotedCents!,
          listingId: inquiry.listingId,
          inquiryId: inquiry.id,
        };
        if (existing) {
          await tx.budgetItem.update({ where: { id: existing.id }, data });
        } else {
          await tx.budgetItem.create({ data });
        }
      }

      // Close "Book the caterer" now that there is a caterer.
      await tx.task.updateMany({
        where: {
          eventId,
          category: inquiry.listing.category,
          status: "TODO",
        },
        data: { status: "DONE" },
      });
    }

    if (status === "DECLINED") {
      // A declined booking should not keep spending the budget.
      await tx.budgetItem.deleteMany({ where: { inquiryId: inquiry.id } });
    }
  });

  // Only the move into BOOKED/DECLINED is worth a line — resaving an edited
  // message on an inquiry that's already in that status isn't new news.
  if (status === "BOOKED" && inquiry.status !== "BOOKED") {
    await record(eventId, {
      actor: "host",
      kind: "inquiry_booked",
      title: `Booked ${inquiry.listing.name}`,
      body: quotedCents !== null ? formatCents(quotedCents) : null,
    });
  } else if (status === "DECLINED" && inquiry.status !== "DECLINED") {
    await record(eventId, { actor: "host", kind: "inquiry_declined", title: `Declined ${inquiry.listing.name}` });
  }

  refresh();
  return undefined;
}

export async function deleteInquiryAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  await requireEvent(eventId);

  // The budget item cascades to null on delete, so remove it explicitly —
  // an orphaned line with no inquiry behind it is worse than no line.
  await db.$transaction(async (tx) => {
    await tx.budgetItem.deleteMany({ where: { inquiryId } });
    await tx.inquiry.deleteMany({ where: { id: inquiryId, eventId } });
  });
  refresh();
}

/**
 * Sends one inquiry, because the host pressed send on that one message.
 *
 * Deliberately not a batch: these are real businesses receiving mail with a
 * host's name on it, and the approval is per message. Only a DRAFT can be
 * sent, so a double-click cannot mail a vendor twice.
 */
export async function sendInquiryAction(
  _prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const { event, user } = await requireEvent(eventId);

  // requireEvent admits a signed-out visitor holding a draft-claim cookie
  // (lib/session.ts:67). Every other outbound-email path refuses that — see
  // sendBlastAction — and this one chooses both recipient and body, so it
  // refuses harder: an anonymous send would leave from HostKit's own domain
  // with no reply address on it.
  if (!user?.email) {
    return { error: "Sign in before sending this." };
  }

  try {
    await assertRateLimit(`outreach:${user.id}`, ...LIMITS.outreach.perActor);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet, so nothing can be sent from here." };
  }

  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, eventId },
    include: { listing: true },
  });
  if (!inquiry) return { error: "That inquiry is no longer here." };

  const to = normalizeRecipient(inquiry.toEmail);
  if (!to) return { error: "Add the vendor's email address first." };

  if (inquiry.status !== "DRAFT") {
    // Cheap pre-check for a better message in the common case. It does not
    // enforce the rule by itself — two near-simultaneous requests can both
    // pass it — the claim below is what actually stops a double send.
    return { error: "That inquiry has already been sent." };
  }

  const { subject } = composeInquiry(event, inquiry.listing, user.name ?? "the host");

  // A row can legitimately be DRAFT with a sentAt already on it (send, then
  // set status back to Draft — updateInquiryAction never clears the
  // timestamp). Capture it before the claim so a failed re-send restores the
  // original value instead of erasing history that goneQuiet reads.
  const previousSentAt = inquiry.sentAt;

  // Claim the row before sending, not after: two tabs (or a fast double-click
  // that beats disabled={pending}) can both read a DRAFT and both pass the
  // check above, but only one updateMany can match it. Whoever loses the
  // claim never sends.
  const claimed = await db.inquiry.updateMany({
    where: { id: inquiry.id, status: "DRAFT" },
    data: { status: "SENT", sentAt: new Date() },
  });
  if (claimed.count === 0) {
    return { error: "That inquiry has already been sent." };
  }

  try {
    await sendEmails([
      inquiryEmail({ to, subject, message: inquiry.message, hostEmail: user.email }),
    ]);
  } catch (error) {
    // Say which end failed, the way lib/email/failure.ts does elsewhere: a
    // host who cannot tell "your sender isn't verified" from "that address
    // bounced" will retry the wrong one forever.
    //
    // `cause` is a getter on EmailSendError (lib/email/failure.ts:26) that
    // classifies the status and body into "sender" | "recipient" | "unknown".
    // It is NOT called `failure` — that is the name of the returned type.
    const failure = error instanceof EmailSendError ? error.cause : "unknown";

    if (failure === "sender" || failure === "recipient") {
      // The provider explicitly rejected this one — nothing left the
      // building — so it is both safe and necessary to undo the claim and
      // let the host fix it and resend.
      await db.inquiry.updateMany({
        where: { id: inquiry.id, status: "SENT" },
        data: { status: "DRAFT", sentAt: previousSentAt },
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
    // throws a plain TypeError here, not an EmailSendError. Reverting to
    // DRAFT would invite a retry that mails the vendor twice, so the row
    // stays claimed as SENT and we say we're not sure, rather than claim
    // nothing went out. The status select already makes SENT→DRAFT a
    // one-click recovery if the host wants to retry anyway.
    return {
      error:
        "We couldn't confirm that went out. It's marked sent — set it back to Draft if you want to try again.",
    };
  }

  await record(eventId, {
    actor: "host",
    kind: "inquiry_sent",
    title: `Emailed ${inquiry.listing.name}`,
    href: `/events/${eventId}/outreach`,
  });

  refresh();
  return undefined;
}
