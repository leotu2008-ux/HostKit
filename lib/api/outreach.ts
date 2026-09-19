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
      message: draft.body,
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
    });
  }
  return rows;
}
