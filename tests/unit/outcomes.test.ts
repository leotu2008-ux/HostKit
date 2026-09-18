import { describe, expect, it } from "vitest";
import { countOutcome, hasFinished } from "@/lib/outcomes";

const HOUR = 3_600_000;

function guest(
  rsvpStatus: "ATTENDING" | "INVITED" | "DECLINED" | "MAYBE" | "PENDING" | "WAITLISTED",
  opts: { came?: boolean; walkUp?: boolean; plusOnes?: number } = {},
) {
  return {
    rsvpStatus,
    plusOnes: opts.plusOnes ?? 0,
    checkedInAt: opts.came ? new Date() : null,
    arrivedWithoutRsvp: opts.walkUp ?? false,
  };
}

describe("counting what happened", () => {
  it("separates who said yes from who actually came", () => {
    const guests = [
      guest("ATTENDING", { came: true }),
      guest("ATTENDING", { came: true }),
      guest("ATTENDING"), // said yes, never showed
      guest("DECLINED"),
    ];
    const out = countOutcome({ guestCount: 10 }, guests);
    expect(out.attendingAtClose).toBe(3);
    expect(out.checkedIn).toBe(2);
  });

  it("counts a walk-up, which is the thing the old code erased", () => {
    // Someone who never replied but turned up. Before the fix, checking them
    // in rewrote their RSVP to ATTENDING and this was unrecoverable.
    const guests = [
      guest("ATTENDING", { came: true }),
      guest("INVITED", { came: true, walkUp: true }),
    ];
    const out = countOutcome({ guestCount: 10 }, guests);
    expect(out.checkedIn).toBe(2);
    expect(out.walkUps).toBe(1);
    expect(out.attendingAtClose).toBe(1);
  });

  it("does not count a no-show as a walk-up", () => {
    const out = countOutcome({ guestCount: 5 }, [guest("INVITED", { walkUp: true })]);
    expect(out.checkedIn).toBe(0);
    expect(out.walkUps).toBe(0);
  });

  it("keeps the capacity the host planned", () => {
    expect(countOutcome({ guestCount: 40 }, []).capacity).toBe(40);
  });

  it("records the estimate the host was actually shown", () => {
    // With nobody invited, the app shows the planned number, so that is what
    // gets scored — not a better figure invented after the fact.
    expect(countOutcome({ guestCount: 40 }, []).expectedHeads).toBe(40);
  });

  it("counts plus-ones toward who said yes", () => {
    const out = countOutcome({ guestCount: 10 }, [guest("ATTENDING", { plusOnes: 2, came: true })]);
    expect(out.checkedIn).toBe(1);
    expect(out.expectedHeads).toBeGreaterThanOrEqual(3);
  });
});

describe("deciding an event is over", () => {
  const base = { date: new Date("2026-09-18T20:00:00Z"), endDate: null, durationHours: 4 };

  it("is not over while it is still running", () => {
    expect(hasFinished(base, new Date("2026-09-18T22:00:00Z"))).toBe(false);
  });

  it("is not over the moment the last hour ends, because nights overrun", () => {
    expect(hasFinished(base, new Date("2026-09-19T00:30:00Z"))).toBe(false);
  });

  it("is over once the grace period has passed", () => {
    expect(hasFinished(base, new Date("2026-09-19T03:00:00Z"))).toBe(true);
  });

  it("prefers an explicit end over the duration", () => {
    const withEnd = { ...base, endDate: new Date("2026-09-19T04:00:00Z") };
    expect(hasFinished(withEnd, new Date("2026-09-19T03:00:00Z"))).toBe(false);
    expect(hasFinished(withEnd, new Date("2026-09-19T07:00:00Z"))).toBe(true);
  });

  it("never completes an event with no date at all", () => {
    expect(hasFinished({ date: null, endDate: null, durationHours: 4 })).toBe(false);
    expect(hasFinished({ date: null, endDate: null, durationHours: 4 }, new Date(Date.now() + 1000 * HOUR))).toBe(false);
  });
});
