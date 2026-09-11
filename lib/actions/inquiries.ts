"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { parseCents } from "@/lib/money";
import { composeInquiry } from "@/lib/outreach";

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
 * Creates the inquiry for a listing, with the outreach message pre-drafted.
 * Idempotent per (event, listing) so hitting "inquire" twice reopens the same
 * thread rather than starting a second one.
 */
export async function startInquiryAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const { event, user } = await requireEvent(eventId);

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return;

  const { body } = composeInquiry(event, listing, user.name);

  await db.inquiry.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId, message: body, status: "DRAFT" },
    update: {},
  });

  // Enquiring is a strong signal of intent, so shortlist it too.
  await db.savedListing.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId },
    update: {},
  });
  refresh();
}

const updateSchema = z.object({
  status: z.enum(STATUSES as [string, ...string[]]),
  quoted: z.string().optional(),
  message: z.string().max(8000).optional(),
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

  await db.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status,
        quotedCents,
        message: parsed.data.message ?? inquiry.message,
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
