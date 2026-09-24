import { describe, expect, it } from "vitest";
import { decideRegistration, stateOf } from "@/lib/registration";
import { promotionPlan, releasesSeat } from "@/lib/waitlist";
import { recipientsFor } from "@/lib/blasts";
import { summarizeGuests } from "@/lib/guests";

describe("decideRegistration", () => {
  const base = { existing: null, isHost: false, requiresApproval: false, seatFree: true };

  it("goes straight in with room and no approval", () => {
    expect(decideRegistration(base)).toBe("going");
  });

  it("queues a request when the host wants to approve", () => {
    expect(decideRegistration({ ...base, requiresApproval: true })).toBe("pending");
    expect(decideRegistration({ ...base, requiresApproval: true, isHost: true })).toBe("going");
  });

  it("waitlists when there's no seat for them, even with approval on", () => {
    expect(decideRegistration({ ...base, seatFree: false })).toBe("waitlisted");
    expect(decideRegistration({ ...base, seatFree: false, requiresApproval: true })).toBe("pending");
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

  // Capacity means people in the room, so a party only goes in whole.
  it("counts a waiting guest's plus-ones against the room", () => {
    const party = { ...t("1"), plusOnes: 2 };
    expect(promotionPlan([party, t("2")], 4).map((g) => g.id)).toEqual(["1", "2"]);
    expect(promotionPlan([t("2"), { ...t("3"), plusOnes: 2 }], 2).map((g) => g.id)).toEqual(["2"]);
  });

  // Two seats free and a party of three first in line: the seats shouldn't sit empty.
  it("passes over a party that doesn't fit the seats left for the ones behind it", () => {
    const party = { ...t("1"), plusOnes: 2 };
    expect(promotionPlan([party, t("2"), t("3")], 2).map((g) => g.id)).toEqual(["2", "3"]);
    expect(promotionPlan([{ ...t("1"), plusOnes: 12 }, t("2")], 1).map((g) => g.id)).toEqual(["2"]);
  });

  it("knows when a status change frees a seat", () => {
    expect(releasesSeat("ATTENDING", "DECLINED")).toBe(true);
    expect(releasesSeat("ATTENDING", null)).toBe(true);
    expect(releasesSeat("ATTENDING", "ATTENDING")).toBe(false);
    expect(releasesSeat("PENDING", "DECLINED")).toBe(false);
  });

  // A waiting party that leaves or shrinks may have been what kept smaller ones out.
  it("moves the line when a waiting party leaves or gets smaller", () => {
    expect(releasesSeat("WAITLISTED", "DECLINED")).toBe(true);
    expect(releasesSeat("WAITLISTED", null)).toBe(true);
    expect(releasesSeat("WAITLISTED", "WAITLISTED", { from: 2, to: 0 })).toBe(true);
    expect(releasesSeat("WAITLISTED", "WAITLISTED", { from: 0, to: 2 })).toBe(false);
  });

  // Capacity is heads, so a guest who stays but brings fewer people frees room.
  it("frees room when an attending guest brings fewer people", () => {
    expect(releasesSeat("ATTENDING", "ATTENDING", { from: 2, to: 1 })).toBe(true);
    expect(releasesSeat("ATTENDING", "ATTENDING", { from: 1, to: 2 })).toBe(false);
    expect(releasesSeat("ATTENDING", "ATTENDING", { from: 1, to: 1 })).toBe(false);
    expect(releasesSeat("INVITED", "ATTENDING", { from: 2, to: 0 })).toBe(false);
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

  it("keeps the waitlist and requests out of 'everyone' and gives the waitlist its own segment", () => {
    expect(recipientsFor("everyone", guests).map((r) => r.name)).toEqual(["A"]);
    expect(recipientsFor("waitlist", guests).map((r) => r.name)).toEqual(["C"]);
  });
});
