import type { CollaboratorKind, CollaboratorStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { composeInquiry, type OutreachEvent } from "@/lib/outreach";
import { CATEGORY_LABEL } from "@/lib/catalog";

export type OutreachRow = {
  id: string;
  kind: CollaboratorKind | "VENDOR";
  name: string;
  detail: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: CollaboratorStatus | "SENT" | "REPLIED" | "QUOTED" | "BOOKED";
  /** Where the row lives: a collaborator, or a catalog inquiry. */
  source: "collaborator" | "inquiry";
  /** Link to the catalog listing, for inquiries. */
  listingPath: string | null;
  subject: string;
  message: string;
  /** When a collaborator send went out. Null for inquiries — those track
   *  sentAt on their own status machine instead (see status above). */
  sentAt: Date | null;
  /** Whether the send form should be offered: a collaborator row with an
   *  email that has not already been sent. Inquiries send from their own
   *  panel (lib/actions/inquiries.ts), not from here. */
  canSend: boolean;
};

/**
 * Everyone the host is lining up for a night, with a drafted first message
 * for each: venue, speakers and cohosts from the collaborator list, and
 * catalog vendors from open inquiries. Shared by the web page and the API.
 */
export async function loadOutreach(
  event: OutreachEvent & { id: string },
  hostName: string,
): Promise<OutreachRow[]> {
  const [collaborators, inquiries] = await Promise.all([
    db.eventCollaborator.findMany({
      where: { eventId: event.id },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    db.inquiry.findMany({
      where: { eventId: event.id },
      include: { listing: { select: { name: true, category: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: OutreachRow[] = collaborators.map((c) => {
    const draft = composeInquiry(event, { name: c.name, role: c.kind }, hostName);
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      detail: c.detail,
      email: c.email,
      phone: c.phone,
      website: c.website,
      status: c.status,
      source: "collaborator",
      listingPath: null,
      subject: draft.subject,
      // The host's own edit, if they saved one, over the composed draft —
      // sendCollaboratorAction mails exactly this, so the panel must show it.
      message: c.message ?? draft.body,
      sentAt: c.sentAt,
      canSend: Boolean(c.email) && !c.sentAt,
    };
  });

  for (const inquiry of inquiries) {
    if (inquiry.status === "DECLINED") continue;
    rows.push({
      id: inquiry.id,
      kind: "VENDOR",
      name: inquiry.listing.name,
      detail: CATEGORY_LABEL[inquiry.listing.category],
      email: inquiry.toEmail,
      phone: null,
      website: null,
      status: inquiry.status === "DRAFT" ? "PENDING" : inquiry.status,
      source: "inquiry",
      listingPath: `/listings/${inquiry.listingId}?event=${event.id}`,
      subject: composeInquiry(event, inquiry.listing, hostName).subject,
      message: inquiry.message,
      sentAt: inquiry.sentAt,
      // Inquiries send from InquiryPanel (its own DRAFT/SENT status machine),
      // not from an OutreachCard form — see components/outreach-card.tsx.
      canSend: false,
    });
  }
  return rows;
}
