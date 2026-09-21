import type { CollaboratorStatus, InquiryStatus } from "@/generated/prisma/enums";

/**
 * Who has not come back to you.
 *
 * A host lining up a venue, caterers, AV and security is tracking six or eight
 * threads at once, and the one that quietly never answered is the one that
 * costs them the date. This is the arithmetic they would otherwise do from
 * memory.
 *
 * It only ever reports. Chasing is a message to a real business, and those go
 * out one at a time with the host's approval — see lib/actions/inquiries.ts
 * and lib/actions/collaborators.ts.
 */

/** Long enough that a vendor has plausibly just been busy, short enough to
 *  still change your mind about them. */
export const CHASE_AFTER_DAYS = 5;

export type ChaseableInquiry = {
  status: InquiryStatus;
  sentAt: Date | null;
  respondedAt: Date | null;
};

export type ChaseableCollaborator = {
  status: CollaboratorStatus;
  sentAt: Date | null;
  respondedAt: Date | null;
};

/** Statuses that mean the vendor has answered, whatever the answer was. */
const ANSWERED: InquiryStatus[] = ["REPLIED", "QUOTED", "BOOKED", "DECLINED"];

/**
 * The shared arithmetic behind "gone quiet": sent, never answered, and long
 * enough ago that following up is reasonable rather than pushy. What counts
 * as "answered" differs between an inquiry (a status machine with its own
 * terminal states) and a collaborator (just PENDING or not), so each caller
 * computes its own `settled` and hands rows here already carrying it.
 */
function quietSince<T extends { sentAt: Date | null; respondedAt: Date | null; settled: boolean }>(
  rows: T[],
  now: Date,
): T[] {
  const cutoff = now.getTime() - CHASE_AFTER_DAYS * 86_400_000;

  return rows.filter((row) => {
    if (row.settled) return false;
    if (row.respondedAt) return false;
    // No timestamp means we cannot say how long it has been, and guessing
    // "forever" would nag about a row that may have been sent minutes ago.
    if (!row.sentAt) return false;
    return row.sentAt.getTime() <= cutoff;
  });
}

export function goneQuiet<T extends ChaseableInquiry>(inquiries: T[], now: Date): T[] {
  return quietSince(
    inquiries.map((inquiry) => ({
      ...inquiry,
      // Unreachable today — status !== "SENT" already excludes every
      // ANSWERED value — kept so a new terminal status fails safe instead of
      // silently being treated as still-open.
      settled: inquiry.status !== "SENT" || ANSWERED.includes(inquiry.status),
    })),
    now,
  );
}

/**
 * Which collaborators (venue/speaker/cohost) have been asked and gone quiet.
 * A collaborator has no status machine like an inquiry's — it is just
 * PENDING until the host marks it CONFIRMED or DECLINED — so "settled"
 * is simply "not still PENDING".
 */
export function quietContacts<T extends ChaseableCollaborator>(rows: T[], now: Date): T[] {
  return quietSince(
    rows.map((row) => ({ ...row, settled: row.status !== "PENDING" })),
    now,
  );
}
