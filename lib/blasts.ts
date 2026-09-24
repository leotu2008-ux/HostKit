import type { RsvpStatus } from "@/generated/prisma/enums";

/**
 * Who a blast goes to. Segments are by RSVP status; only rows with an email
 * can receive anything, and registrations always have one.
 */
export const SEGMENTS = {
  going: "Going",
  pending: "Haven't replied",
  waitlist: "Waitlist",
  everyone: "Everyone on the list",
} as const;

export type Segment = keyof typeof SEGMENTS;

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[];

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && value in SEGMENTS;
}

export type Recipient = { name: string; email: string };
export type PhoneRecipient = { name: string; phone: string };

/** Cap on texts per blast — Twilio sends one at a time. */
export const SMS_CAP = 200;

/** The segment's guests whose account has a verified phone, de-duplicated. */
export function phoneRecipientsFor(
  segment: Segment,
  guests: Array<{
    name: string;
    rsvpStatus: RsvpStatus;
    user?: { phone: string | null; phoneVerifiedAt: Date | null } | null;
  }>,
): PhoneRecipient[] {
  const seen = new Set<string>();
  const out: PhoneRecipient[] = [];
  for (const guest of guests) {
    const phone = guest.user?.phone && guest.user.phoneVerifiedAt ? guest.user.phone : null;
    if (!phone || !inSegment(segment, guest.rsvpStatus) || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ name: guest.name, phone });
    if (out.length >= SMS_CAP) break;
  }
  return out;
}

export function inSegment(segment: Segment, status: RsvpStatus): boolean {
  // "Everyone" is everyone who might come — not the declined, and not the
  // waitlist or requesters you haven't approved, who'd read "doors at 7" as
  // "you're in". The waitlist has its own; approve requesters from Guests.
  return segment === "everyone"
    ? status !== "DECLINED" && status !== "WAITLISTED" && status !== "PENDING"
    : segment === "going"
      ? status === "ATTENDING"
      : segment === "waitlist"
        ? status === "WAITLISTED"
        : status === "INVITED";
}

export function recipientsFor(
  segment: Segment,
  guests: Array<{ name: string; email: string | null; rsvpStatus: RsvpStatus }>,
): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const guest of guests) {
    if (!guest.email) continue;
    if (!inSegment(segment, guest.rsvpStatus)) continue;
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
