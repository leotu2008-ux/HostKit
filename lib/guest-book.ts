import { db } from "@/lib/db";
import { newRsvpToken } from "@/lib/tokens";

/** Came = said yes, or was checked in at the door. */
const CAME = { OR: [{ rsvpStatus: "ATTENDING" as const }, { checkedInAt: { not: null } }] };

export type GuestBookEntry = { id: string; name: string; email: string | null; came: number };

/** Guest-book emails are stored lowercased and trimmed; blank means none. */
export function contactEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * Links every guest of this event who has an email to the host's Contact for
 * that address, creating the Contact the first time. Idempotent: only guests
 * without a contact are touched. Events with no owner have no guest book.
 */
export async function linkGuestsToContacts(eventId: string): Promise<number> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event?.ownerId) return 0;
  const ownerId = event.ownerId;

  const guests = await db.guest.findMany({
    where: { eventId, contactId: null, email: { not: null } },
    select: { id: true, name: true, email: true },
  });

  let linked = 0;
  for (const guest of guests) {
    const email = contactEmail(guest.email);
    if (!email) continue;
    const contact = await db.contact.upsert({
      where: { ownerId_email: { ownerId, email } },
      create: { ownerId, name: guest.name, email },
      update: {},
    });
    await db.guest.update({ where: { id: guest.id }, data: { contactId: contact.id } });
    linked += 1;
  }
  return linked;
}

/** People who came to one of this host's other events and aren't on this one. Most-attended first. */
export async function guestBookFor(ownerId: string, eventId: string): Promise<GuestBookEntry[]> {
  const onThisEvent = await db.guest.findMany({
    where: { eventId, contactId: { not: null } },
    select: { contactId: true },
  });
  const exclude = onThisEvent.map((g) => g.contactId as string);

  const contacts = await db.contact.findMany({
    where: { ownerId, id: { notIn: exclude }, guests: { some: { eventId: { not: eventId }, ...CAME } } },
    select: { id: true, name: true, email: true, _count: { select: { guests: { where: CAME } } } },
  });

  return contacts
    .map((c) => ({ id: c.id, name: c.name, email: c.email, came: c._count.guests }))
    .sort((a, b) => b.came - a.came || a.name.localeCompare(b.name));
}

/**
 * Invites the chosen contacts to this event as INVITED guests. Only the
 * owner's own contacts are used, and anyone already on the list (by contact or
 * by email) is skipped. Returns how many were added.
 */
export async function inviteFromGuestBook(eventId: string, ownerId: string, contactIds: string[]): Promise<number> {
  if (contactIds.length === 0) return 0;
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds }, ownerId },
    select: { id: true, name: true, email: true },
  });
  const existing = await db.guest.findMany({ where: { eventId }, select: { contactId: true, email: true } });
  const onList = new Set(existing.map((g) => g.contactId).filter(Boolean));
  const emails = new Set(existing.map((g) => contactEmail(g.email)).filter(Boolean));

  const fresh = contacts.filter((c) => !onList.has(c.id) && !(c.email && emails.has(c.email)));
  if (fresh.length === 0) return 0;

  await db.guest.createMany({
    data: fresh.map((c) => ({ eventId, contactId: c.id, name: c.name, email: c.email, rsvpToken: newRsvpToken() })),
  });
  return fresh.length;
}
