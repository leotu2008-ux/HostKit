import type { EventStatus, RsvpStatus } from "@/generated/prisma/enums";
import { formatEventDate, formatEventTime, hasClock } from "@/lib/when";

/**
 * Who a blast goes to. Segments are by RSVP status (and, for "came", a
 * check-in); only rows with an email can receive anything, and registrations
 * always have one.
 */
export const SEGMENTS = {
  going: "Going",
  pending: "Haven't replied",
  waitlist: "Waitlist",
  everyone: "Everyone on the list",
  came: "Came",
} as const;

export type Segment = keyof typeof SEGMENTS;

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[];

type SegmentGuest = { rsvpStatus: RsvpStatus; checkedInAt?: Date | null };

/**
 * The segments a blast can go to for this night. "Came" is for the morning
 * after: offered only once the night has happened (not cancelled, and past
 * its last acceptable day when the date is flexible) and the door was run —
 * the same rule as the guest book.
 */
export function segmentsFor(
  event: { date: Date | null; endDate: Date | null; status: EventStatus },
  guests: Array<{ checkedInAt?: Date | null }>,
  now = new Date(),
): Segment[] {
  const end = event.endDate ?? event.date;
  const happened = event.status !== "CANCELLED" && end !== null && end < now;
  const doorRun = guests.some((g) => g.checkedInAt);
  return SEGMENT_KEYS.filter((key) => key !== "came" || (happened && doorRun));
}

export type Recipient = { name: string; email: string };
export type PhoneRecipient = { name: string; phone: string };

/** Cap on texts per blast — Twilio sends one at a time. */
export const SMS_CAP = 200;

/** The segment's guests whose account has a verified phone, de-duplicated. */
export function phoneRecipientsFor(
  segment: Segment,
  guests: Array<
    SegmentGuest & {
      name: string;
      user?: { phone: string | null; phoneVerifiedAt: Date | null } | null;
    }
  >,
): PhoneRecipient[] {
  const seen = new Set<string>();
  const out: PhoneRecipient[] = [];
  for (const guest of guests) {
    const phone = guest.user?.phone && guest.user.phoneVerifiedAt ? guest.user.phone : null;
    if (!phone || !inSegment(segment, guest) || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ name: guest.name, phone });
    if (out.length >= SMS_CAP) break;
  }
  return out;
}

export function inSegment(segment: Segment, guest: SegmentGuest): boolean {
  const status = guest.rsvpStatus;
  // "Everyone" is everyone who might come — not the declined, and not the
  // waitlist or requesters you haven't approved, who'd read "doors at 7" as
  // "you're in". The waitlist has its own; approve requesters from Guests.
  return segment === "everyone"
    ? status !== "DECLINED" && status !== "WAITLISTED" && status !== "PENDING"
    : segment === "going"
      ? status === "ATTENDING"
      : segment === "came"
        ? status === "ATTENDING" && Boolean(guest.checkedInAt)
        : segment === "waitlist"
          ? status === "WAITLISTED"
          : status === "INVITED";
}

export function recipientsFor(
  segment: Segment,
  guests: Array<SegmentGuest & { name: string; email: string | null }>,
): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const guest of guests) {
    if (!guest.email) continue;
    if (!inSegment(segment, guest)) continue;
    const email = guest.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: guest.name, email });
  }
  return out;
}

/** Fills `{name}` in a body so each guest gets their own greeting. */
export function personalize(body: string, name: string): string {
  return body.replaceAll("{name}", name.split(/\s+/)[0] || name);
}

/** The two before-the-night drafts the briefing offers (lib/agent/briefing.ts). */
export type BlastDraftKind = "nudge" | "reminder";

export function isBlastDraftKind(value: unknown): value is BlastDraftKind {
  return value === "nudge" || value === "reminder";
}

/**
 * A starting message the host edits and sends themselves — built only from
 * the night's saved title and start, never anything Hosty would have to guess.
 * The nudge goes to the unreplied about a week out; the reminder to the
 * guests going the day before (never the waitlist).
 */
export function blastDraft(
  kind: BlastDraftKind,
  event: { title: string; date: Date | null },
): { segment: Segment; subject: string; body: string } {
  const time = event.date && hasClock(event.date) ? formatEventTime(event.date) : null;
  if (kind === "reminder") {
    return {
      segment: "going",
      subject: `See you tomorrow: ${event.title}`,
      body: `Hi {name},\n\nA reminder that ${event.title} is tomorrow${time ? ` at ${time}` : ""}. See you there.\n\n`,
    };
  }
  const day = formatEventDate(event.date);
  const ask = day
    ? `${event.title} is ${day}${time ? ` at ${time}` : ""}. Can you make it?`
    : `Can you make it to ${event.title}?`;
  return {
    segment: "pending",
    subject: `${event.title}: can you make it?`,
    body: `Hi {name},\n\n${ask} Let me know either way.\n\n`,
  };
}
