import type { InquiryStatus } from "@/generated/prisma/enums";

/**
 * Who has not come back to you.
 *
 * A host lining up a venue, caterers, AV and security is tracking six or eight
 * threads at once, and the one that quietly never answered is the one that
 * costs them the date. This is the arithmetic they would otherwise do from
 * memory.
 *
 * It only ever reports. Chasing is a message to a real business, and those go
 * out one at a time with the host's approval — see lib/actions/inquiries.ts.
 */

/** Long enough that a vendor has plausibly just been busy, short enough to
 *  still change your mind about them. */
export const CHASE_AFTER_DAYS = 5;

export type ChaseableInquiry = {
  status: InquiryStatus;
  sentAt: Date | null;
  respondedAt: Date | null;
};

/** Statuses that mean the vendor has answered, whatever the answer was. */
const ANSWERED: InquiryStatus[] = ["REPLIED", "QUOTED", "BOOKED", "DECLINED"];

export function goneQuiet<T extends ChaseableInquiry>(inquiries: T[], now: Date): T[] {
  const cutoff = now.getTime() - CHASE_AFTER_DAYS * 86_400_000;

  return inquiries.filter((inquiry) => {
    if (inquiry.status !== "SENT") return false;
    // Unreachable today; fails safe if a new terminal status is added.
    if (ANSWERED.includes(inquiry.status)) return false;
    if (inquiry.respondedAt) return false;
    // No timestamp means we cannot say how long it has been, and guessing
    // "forever" would nag about a row that may have been sent minutes ago.
    if (!inquiry.sentAt) return false;
    return inquiry.sentAt.getTime() <= cutoff;
  });
}
