import type { CollaboratorKind, ListingCategory } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type VendorBookEntry = {
  id: string;
  name: string;
  kind: CollaboratorKind | null;
  category: ListingCategory | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  listingId: string | null;
};

/**
 * A venue, speaker or cohost was confirmed: put them in the host's vendor book
 * (matching an existing entry of the same kind and name, any case) and link
 * the collaborator to it.
 *
 * Two confirmations of the same venue/speaker/cohost (a double-click, or two
 * identical collaborators) can race between the find and the create, each
 * missing the other's not-yet-committed row and both creating a duplicate
 * entry. `pg_advisory_xact_lock(hashtext(ownerId))` serializes vendor-book
 * writes per host for the length of the transaction, so the second racer
 * waits for the lock, then sees the first racer's write on its re-read of the
 * collaborator and simply returns instead of duplicating.
 */
export async function rememberCollaborator(collaboratorId: string): Promise<void> {
  const collab = await db.eventCollaborator.findUnique({
    where: { id: collaboratorId },
    select: {
      id: true,
      kind: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      vendorContactId: true,
      event: { select: { ownerId: true } },
    },
  });
  const ownerId = collab?.event.ownerId;
  if (!collab || !ownerId || collab.vendorContactId) return;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;

    // Another request may have linked this collaborator while we waited for
    // the lock — re-read inside the transaction rather than trusting the
    // pre-lock lookup above.
    const current = await tx.eventCollaborator.findUnique({
      where: { id: collab.id },
      select: { vendorContactId: true },
    });
    if (current?.vendorContactId) return;

    const existing = await tx.vendorContact.findFirst({
      where: { ownerId, kind: collab.kind, name: { equals: collab.name, mode: "insensitive" } },
      select: { id: true },
    });
    const entry =
      existing ??
      (await tx.vendorContact.create({
        data: {
          ownerId,
          kind: collab.kind,
          name: collab.name,
          email: collab.email,
          phone: collab.phone,
          website: collab.website,
        },
        select: { id: true },
      }));
    await tx.eventCollaborator.update({ where: { id: collab.id }, data: { vendorContactId: entry.id } });
  });
}

/** A catalog vendor was booked: one vendor-book entry per host and listing. */
export async function rememberBookedListing(eventId: string, listingId: string): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event?.ownerId) return;
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true, name: true, category: true },
  });
  if (!listing) return;
  await db.vendorContact.upsert({
    where: { ownerId_listingId: { ownerId: event.ownerId, listingId: listing.id } },
    create: { ownerId: event.ownerId, listingId: listing.id, name: listing.name, category: listing.category },
    update: {},
  });
}

/** Everyone in the host's vendor book, alphabetically. */
export async function vendorBookFor(ownerId: string): Promise<VendorBookEntry[]> {
  return db.vendorContact.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, category: true, email: true, phone: true, website: true, listingId: true },
  });
}

/**
 * Adds a hand-entered vendor-book entry to an event as a PENDING collaborator.
 * Only the owner's own entries, and only venue/speaker/cohost ones. Catalog
 * vendors go through their listing's inquiry flow instead. Skips (and
 * returns false) when this event already has a collaborator linked to that
 * vendor-book entry, so re-clicking "Add to this event" can't duplicate it.
 */
export async function addVendorToEvent(eventId: string, ownerId: string, vendorContactId: string): Promise<boolean> {
  const entry = await db.vendorContact.findFirst({ where: { id: vendorContactId, ownerId } });
  if (!entry || !entry.kind) return false;
  const already = await db.eventCollaborator.findFirst({
    where: { eventId, vendorContactId: entry.id },
    select: { id: true },
  });
  if (already) return false;
  await db.eventCollaborator.create({
    data: {
      eventId,
      kind: entry.kind,
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      website: entry.website,
      status: "PENDING",
      source: "MANUAL",
      vendorContactId: entry.id,
    },
  });
  return true;
}
