import type { RsvpStatus } from "@/generated/prisma/enums";

export type GuestLike = {
  rsvpStatus: RsvpStatus;
  plusOnes: number;
};

export type GuestSummary = {
  invited: number;
  attending: number;
  declined: number;
  maybe: number;
  awaiting: number;
  /** Asked to join an approval-required night; the host hasn't decided. */
  pending: number;
  /** Wanted in when the night was full; promoted in order as seats free. */
  waitlisted: number;
  /** Heads confirmed coming, including plus-ones. */
  confirmedHeads: number;
  /** Heads that have actively said no, including their plus-ones. */
  declinedHeads: number;
  /**
   * The number to plan against: everyone who has not actually declined,
   * counting plus-ones. See effectiveHeadcount for why this and not the
   * confirmed count.
   */
  expectedHeads: number;
  responded: number;
  responseRate: number;
};

function heads(guest: GuestLike): number {
  return 1 + Math.max(0, guest.plusOnes);
}

export function summarizeGuests(guests: GuestLike[]): GuestSummary {
  const by = (status: RsvpStatus) =>
    guests.filter((g) => g.rsvpStatus === status);

  const attending = by("ATTENDING");
  const declined = by("DECLINED");
  const maybe = by("MAYBE");
  const awaiting = by("INVITED");
  const pending = by("PENDING");
  const waitlisted = by("WAITLISTED");

  const confirmedHeads = attending.reduce((sum, g) => sum + heads(g), 0);
  const declinedHeads = declined.reduce((sum, g) => sum + heads(g), 0);
  // Someone who asked to join is likely coming, so they count toward the
  // planning number like an unanswered invite; the waitlist doesn't fit.
  const expectedHeads =
    confirmedHeads +
    maybe.reduce((sum, g) => sum + heads(g), 0) +
    awaiting.reduce((sum, g) => sum + heads(g), 0) +
    pending.reduce((sum, g) => sum + heads(g), 0);

  const responded = attending.length + declined.length + maybe.length;
  const askable = guests.length - waitlisted.length;

  return {
    invited: guests.length,
    attending: attending.length,
    declined: declined.length,
    maybe: maybe.length,
    awaiting: awaiting.length,
    pending: pending.length,
    waitlisted: waitlisted.length,
    confirmedHeads,
    declinedHeads,
    expectedHeads,
    responded,
    responseRate: askable ? Math.round((responded / askable) * 100) : 0,
  };
}

/**
 * The headcount the rest of the app should plan against.
 *
 * Deliberately NOT the confirmed count, and not the guest list either. Both
 * are wrong in the same expensive direction: a host who has entered four of
 * forty names, or whose first four replies are in, must not have their venue
 * repriced for four guests.
 *
 * So: start from the host's own estimate, subtract the people who have
 * actually said no, and take the guest list instead if it turns out bigger
 * than the estimate. The number therefore starts at the planned figure and
 * only ever moves for a real signal — a regret, or an invite list that grew.
 */
export function effectiveHeadcount(
  plannedGuestCount: number,
  summary: GuestSummary,
): { count: number; source: "planned" | "rsvp" } {
  if (summary.invited === 0) {
    return { count: plannedGuestCount, source: "planned" };
  }

  const afterRegrets = Math.max(0, plannedGuestCount - summary.declinedHeads);
  const count = Math.max(summary.expectedHeads, afterRegrets);

  // Only call it RSVP-driven when the replies are actually moving the number;
  // otherwise the host is still looking at their own estimate.
  const source =
    summary.declinedHeads > 0 || summary.expectedHeads > plannedGuestCount
      ? "rsvp"
      : "planned";

  return { count, source };
}

/**
 * Parses a pasted list into guests. Accepts "Name <email>", "Name, email",
 * "Name email" or a bare name per line — hosts paste from wherever the list
 * already lives, and rejecting their format is a good way to lose them.
 *
 * Emails come back lowercased (registration and the guest book match on the
 * lowercased form), and an email repeated within one paste keeps its first
 * line only. Names without an email are never merged: two Sams are two people.
 */
export function parseGuestList(
  input: string,
): Array<{ name: string; email: string | null }> {
  const EMAIL = /[^\s,<>]+@[^\s,<>]+\.[^\s,<>]+/;
  const seen = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(EMAIL);
      const typed = match ? match[0] : null;
      const name = (typed ? line.replace(typed, "") : line)
        .replace(/[<>]/g, "")
        .replace(/[,;]+/g, " ")
        .trim();
      return { name: name || (typed ?? "Guest"), email: typed?.toLowerCase() ?? null };
    })
    .filter((guest) => {
      if (guest.name.length === 0) return false;
      if (!guest.email) return true;
      if (seen.has(guest.email)) return false;
      seen.add(guest.email);
      return true;
    });
}
