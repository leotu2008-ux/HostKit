import { describe, expect, it } from "vitest";
import { MAX_PER_ORDER, judgeTicket, onSale, type ScannedTicket, type TierWithSales } from "@/lib/tickets";

const tier = (over: Partial<TierWithSales> = {}): TierWithSales => ({
  id: "t1",
  name: "General",
  priceCents: 1500,
  quantity: 100,
  salesOpenAt: null,
  salesCloseAt: null,
  sold: 0,
  left: 100,
  ...over,
});

const now = new Date("2026-09-20T18:00:00Z");

describe("what's on sale", () => {
  it("sells when there is stock and no window", () => {
    expect(onSale(tier(), now)).toBe(true);
  });

  it("stops at sold out", () => {
    expect(onSale(tier({ left: 0, sold: 100 }), now)).toBe(false);
  });

  it("respects both ends of a sales window", () => {
    expect(onSale(tier({ salesOpenAt: new Date("2026-09-21T00:00:00Z") }), now)).toBe(false);
    expect(onSale(tier({ salesCloseAt: new Date("2026-09-19T00:00:00Z") }), now)).toBe(false);
    expect(
      onSale(
        tier({
          salesOpenAt: new Date("2026-09-01T00:00:00Z"),
          salesCloseAt: new Date("2026-09-30T00:00:00Z"),
        }),
        now,
      ),
    ).toBe(true);
  });

  it("caps an order at something a person would plausibly buy", () => {
    expect(MAX_PER_ORDER).toBeLessThanOrEqual(10);
  });
});

describe("the door", () => {
  const ticket = (over: Partial<ScannedTicket> = {}): ScannedTicket => ({
    eventId: "ev1",
    status: "PAID",
    voidedAt: null,
    checkedInAt: null,
    ...over,
  });

  it("admits a paid ticket once", () => {
    expect(judgeTicket(ticket(), "ev1")).toEqual({ kind: "ok" });
  });

  it("catches a second scan and says when the first was", () => {
    const at = new Date("2026-09-20T22:14:00Z");
    expect(judgeTicket(ticket({ checkedInAt: at }), "ev1")).toEqual({ kind: "already", at });
  });

  it("separates unpaid from void, because the door treats them differently", () => {
    // Money never arrived — the organiser can still wave them through.
    expect(judgeTicket(ticket({ status: "PENDING" }), "ev1")).toEqual({ kind: "unpaid" });
    // Refunded or cancelled — not a judgement call.
    expect(judgeTicket(ticket({ status: "REFUNDED" }), "ev1")).toEqual({ kind: "void" });
    expect(judgeTicket(ticket({ status: "CANCELLED" }), "ev1")).toEqual({ kind: "void" });
    expect(judgeTicket(ticket({ voidedAt: new Date() }), "ev1")).toEqual({ kind: "void" });
  });

  it("rejects a ticket for another night", () => {
    expect(judgeTicket(ticket(), "ev2")).toEqual({ kind: "wrong-event" });
  });

  it("rejects an unknown token", () => {
    expect(judgeTicket(null, "ev1")).toEqual({ kind: "not-found" });
  });

  it("calls a voided ticket void even when it was already scanned", () => {
    const seen = ticket({ voidedAt: new Date(), checkedInAt: new Date() });
    expect(judgeTicket(seen, "ev1").kind).toBe("void");
  });
});
