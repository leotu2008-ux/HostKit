import { describe, expect, it } from "vitest";
import { decideRegistration, stateOf } from "@/lib/registration";
import { promotionPlan, releasesSeat } from "@/lib/waitlist";
import { recipientsFor } from "@/lib/blasts";
import { summarizeGuests } from "@/lib/guests";

describe("decideRegistration", () => {
  const base = { existing: null, isHost: false, requiresApproval: false, attending: 3, capacity: 10 };

  it("goes straight in with room and no approval", () => {
    expect(decideRegistration(base)).toBe("going");
  });

  it("queues a request when the host wants to approve", () => {
    expect(decideRegistration({ ...base, requiresApproval: true })).toBe("pending");
    expect(decideRegistration({ ...base, requiresApproval: true, isHost: true })).toBe("going");
  });

  it("waitlists when full, even with approval on", () => {
    expect(decideRegistration({ ...base, attending: 10 })).toBe("waitlisted");
    expect(decideRegistration({ ...base, attending: 10, requiresApproval: true })).toBe("pending");
  });

  it("is idempotent for people already in, asked, or waiting", () => {
    expect(decideRegistration({ ...base, existing: "ATTENDING" })).toBe("unchanged");
    expect(decideRegistration({ ...base, existing: "PENDING" })).toBe("unchanged");
    expect(decideRegistration({ ...base, existing: "WAITLISTED" })).toBe("unchanged");
  });

  it("never flips a decline from the register button", () => {
    expect(decideRegistration({ ...base, existing: "DECLINED" })).toBe("declined");
  });

  it("maps statuses to states", () => {
    expect(stateOf("ATTENDING")).toBe("going");
    expect(stateOf("PENDING")).toBe("pending");
    expect(stateOf("WAITLISTED")).toBe("waitlisted");
    expect(stateOf("MAYBE")).toBe("none");
    expect(stateOf(null)).toBe("none");
  });
});

describe("waitlist", () => {
  const t = (s: string) => ({ id: s, createdAt: new Date(`2026-09-11T10:0${s}:00Z`) });

  it("promotes the longest-waiting first and stops at the room available", () => {
    expect(promotionPlan([t("3"), t("1"), t("2")], 2).map((g) => g.id)).toEqual(["1", "2"]);
    expect(promotionPlan([t("1")], 0)).toEqual([]);
  });

  it("knows when a status change frees a seat", () => {
    expect(releasesSeat("ATTENDING", "DECLINED")).toBe(true);
    expect(releasesSeat("ATTENDING", null)).toBe(true);
    expect(releasesSeat("ATTENDING", "ATTENDING")).toBe(false);
    expect(releasesSeat("PENDING", "DECLINED")).toBe(false);
  });
});

describe("new statuses across the guest maths", () => {
  const guests = [
    { name: "A", email: "a@x.com", rsvpStatus: "ATTENDING" as const, plusOnes: 1 },
    { name: "B", email: "b@x.com", rsvpStatus: "PENDING" as const, plusOnes: 0 },
    { name: "C", email: "c@x.com", rsvpStatus: "WAITLISTED" as const, plusOnes: 0 },
    { name: "D", email: "d@x.com", rsvpStatus: "DECLINED" as const, plusOnes: 0 },
  ];

  it("counts requests toward the plan and keeps the waitlist out of it", () => {
    const s = summarizeGuests(guests);
    expect(s.pending).toBe(1);
    expect(s.waitlisted).toBe(1);
    expect(s.expectedHeads).toBe(3); // A + plus-one, B
    expect(s.responseRate).toBe(67); // A and D of the 3 askable
  });

  it("keeps the waitlist out of 'everyone' and gives it its own segment", () => {
    expect(recipientsFor("everyone", guests).map((r) => r.name)).toEqual(["A", "B"]);
    expect(recipientsFor("waitlist", guests).map((r) => r.name)).toEqual(["C"]);
  });
});
