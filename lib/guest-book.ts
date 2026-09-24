import type { RsvpStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { hasStarted } from "@/lib/outcomes";
import { newRsvpToken } from "@/lib/tokens";

/**
 * Came = checked in at the door, or said yes to an event where the host never
 * ran the door. Once anyone was checked in at an event, the check-ins are the
 * truth there, so a yes who never walked in doesn't count (as in turnout).
 * A yes only counts once the night has happened: not for one still ahead
 * (flexible dates: until the last acceptable day) and not for a cancelled one.
 */
function came(doorEventIds: string[], pastNightIds: string[]) {
  const door = new Set(doorEventIds);
  return {
    OR: [
      { checkedInAt: { not: null } },
      { rsvpStatus: "ATTENDING" as const, eventId: { in: pastNightIds.filter((id) => !door.has(id)) } },
    ],
  };
}

type Night = { date: Date | null; endDate: Date | null; schoolDomain: string | null };

/** The host's nights, cancelled ones left out; filter with `happened`. */
const NIGHTS = { status: { not: "CANCELLED" as const } };

/**
 * Whether a night has happened: its start has passed on the clock at the
 * event's school (`date` is wall-clock time, see `hasStarted`). A flexible
 * night has happened once its last acceptable day has.
 */
function happened(night: Night, now: Date): boolean {
  return hasStarted({ date: night.endDate ?? night.date, schoolDomain: night.schoolDomain }, now);
}

/**
 * Contacts still on the waitlist at the host's most recent other night that
 * has happened: they wanted in and didn't get a seat, so they get first dibs.
 */
async function missedOutLastTime(eventId: string, pastNights: (Night & { id: string })[]): Promise<string[]> {
  const when = (n: Night) => n.date?.getTime() ?? 0;
  const last = pastNights.filter((n) => n.id !== eventId).sort((a, b) => when(b) - when(a))[0];
  if (!last) return [];
  const rows = await db.guest.findMany({
    where: { eventId: last.id, rsvpStatus: "WAITLISTED", checkedInAt: null, contactId: { not: null } },
    select: { contactId: true },
  });
  return rows.map((g) => g.contactId as string);
}

export type GuestBookEntry = { id: string; name: string; email: string | null; came: number; missedOut: boolean };

/** Guest-book emails are stored lowercased and trimmed; blank means none. */
export function contactEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * Links every guest of this event who has an email to the host's Contact for
 * that address, creating the Contact the first time. Idempotent: only guests
 * without a contact are touched. Events with no owner have no guest book.
 *
 * Batched to avoid an N+1: one createMany for the new contacts, one findMany
 * to get their ids, then one updateMany per distinct email (not per guest).
 */
export async function linkGuestsToContacts(eventId: string): Promise<number> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event?.ownerId) return 0;
  const ownerId = event.ownerId;

  const guests = await db.guest.findMany({
    where: { eventId, contactId: null, email: { not: null } },
    select: { id: true, name: true, email: true },
  });

  const byEmail = new Map<string, { name: string; guestIds: string[] }>();
  for (const guest of guests) {
    const email = contactEmail(guest.email);
    if (!email) continue;
    const entry = byEmail.get(email);
    if (entry) entry.guestIds.push(guest.id);
    else byEmail.set(email, { name: guest.name, guestIds: [guest.id] });
  }
  if (byEmail.size === 0) return 0;

  const emails = [...byEmail.keys()];
  await db.contact.createMany({
    data: emails.map((email) => ({ ownerId, name: byEmail.get(email)!.name, email })),
    skipDuplicates: true,
  });

  const contacts = await db.contact.findMany({
    where: { ownerId, email: { in: emails } },
    select: { id: true, email: true },
  });

  let linked = 0;
  for (const contact of contacts) {
    const entry = contact.email ? byEmail.get(contact.email) : undefined;
    if (!entry) continue;
    const result = await db.guest.updateMany({
      where: { eventId, contactId: null, id: { in: entry.guestIds } },
      data: { contactId: contact.id },
    });
    linked += result.count;
  }
  return linked;
}

/**
 * People who came to one of this host's other events and aren't on this one,
 * plus anyone who missed out on the host's last night. Those who missed out
 * come first, then most-attended.
 */
export async function guestBookFor(ownerId: string, eventId: string, now = new Date()): Promise<GuestBookEntry[]> {
  const [onThisEvent, doorEvents, nights] = await Promise.all([
    db.guest.findMany({ where: { eventId, contactId: { not: null } }, select: { contactId: true } }),
    db.event.findMany({ where: { ownerId, guests: { some: { checkedInAt: { not: null } } } }, select: { id: true } }),
    db.event.findMany({
      where: { ownerId, ...NIGHTS },
      select: { id: true, date: true, endDate: true, schoolDomain: true },
    }),
  ]);
  const pastNights = nights.filter((n) => happened(n, now));
  const missedIds = await missedOutLastTime(eventId, pastNights);
  const exclude = onThisEvent.map((g) => g.contactId as string);
  const missed = new Set(missedIds.filter((id) => !exclude.includes(id)));
  const CAME = came(
    doorEvents.map((e) => e.id),
    pastNights.map((n) => n.id),
  );
  const cameBefore = { guests: { some: { eventId: { not: eventId }, ...CAME } } };

  const contacts = await db.contact.findMany({
    where: {
      ownerId,
      id: { notIn: exclude },
      ...(missed.size > 0 ? { OR: [cameBefore, { id: { in: [...missed] } }] } : cameBefore),
    },
    select: { id: true, name: true, email: true, _count: { select: { guests: { where: CAME } } } },
  });

  return contacts
    .map((c) => ({ id: c.id, name: c.name, email: c.email, came: c._count.guests, missedOut: missed.has(c.id) }))
    .sort(
      (a, b) => Number(b.missedOut) - Number(a.missedOut) || b.came - a.came || a.name.localeCompare(b.name),
    );
}

type TurnoutNight = {
  id: string;
  date: Date | null;
  endDate: Date | null;
  guests: { contactId: string | null; rsvpStatus: RsvpStatus; checkedInAt: Date | null }[];
};

export type NightTurnout = { came: number; fresh: number };

/**
 * For each night that happened: how many came (the guest book's rule, per
 * night) and how many of them came to none of the earlier nights. Pure. A
 * guest with no contact counts as came but can't be called new.
 */
export function cameAndNew(nights: TurnoutNight[]): Map<string, NightTurnout> {
  const when = (n: TurnoutNight) => (n.date ?? n.endDate)?.getTime() ?? 0;
  const seen = new Set<string>();
  const result = new Map<string, NightTurnout>();
  for (const night of [...nights].sort((a, b) => when(a) - when(b))) {
    const door = night.guests.some((g) => g.checkedInAt);
    const cameHere = night.guests.filter((g) => (door ? g.checkedInAt : g.rsvpStatus === "ATTENDING"));
    const contacts = new Set(cameHere.flatMap((g) => (g.contactId ? [g.contactId] : [])));
    const fresh = [...contacts].filter((id) => !seen.has(id)).length;
    contacts.forEach((id) => seen.add(id));
    result.set(night.id, { came: cameHere.length, fresh });
  }
  return result;
}

/** `cameAndNew` over every night this host has had, keyed by event id. */
export async function nightlyTurnout(ownerId: string, now = new Date()): Promise<Map<string, NightTurnout>> {
  const nights = await db.event.findMany({
    where: { ownerId, ...NIGHTS },
    select: {
      id: true,
      date: true,
      endDate: true,
      schoolDomain: true,
      guests: {
        where: { OR: [{ checkedInAt: { not: null } }, { rsvpStatus: "ATTENDING" }] },
        select: { contactId: true, rsvpStatus: true, checkedInAt: true },
      },
    },
  });
  return cameAndNew(nights.filter((n) => happened(n, now)));
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
