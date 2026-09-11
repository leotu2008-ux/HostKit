import { describe, expect, it } from "vitest";
import { itemCommitment, summarizeBudget } from "@/lib/budget";

const item = (
  estimatedCents: number,
  actualCents: number | null = null,
  paidCents = 0,
) => ({ estimatedCents, actualCents, paidCents });

describe("itemCommitment", () => {
  it("uses the estimate until a real figure exists", () => {
    expect(itemCommitment(item(500_000))).toBe(500_000);
  });

  it("lets the real figure replace the estimate rather than add to it", () => {
    expect(itemCommitment(item(500_000, 620_000))).toBe(620_000);
  });

  it("respects an actual of zero instead of falling back to the estimate", () => {
    // A vendor who came in free is not a vendor with an unknown price.
    expect(itemCommitment(item(500_000, 0))).toBe(0);
  });
});

describe("summarizeBudget", () => {
  const categories = [
    {
      category: "VENUE" as const,
      name: "Venue",
      allocatedCents: 800_000,
      items: [item(750_000, 820_000, 200_000)],
    },
    {
      category: "CATERING" as const,
      name: "Catering",
      allocatedCents: 600_000,
      items: [item(400_000, null, 0), item(100_000, null, 50_000)],
    },
    {
      category: "FLORALS" as const,
      name: "Florals",
      allocatedCents: 200_000,
      items: [],
    },
  ];

  it("rolls commitments up to a total", () => {
    const s = summarizeBudget(categories);
    expect(s.allocatedCents).toBe(1_600_000);
    expect(s.committedCents).toBe(820_000 + 500_000);
    expect(s.paidCents).toBe(250_000);
  });

  it("reports what is left and what is still owed", () => {
    const s = summarizeBudget(categories);
    expect(s.remainingCents).toBe(1_600_000 - 1_320_000);
    expect(s.outstandingCents).toBe(1_320_000 - 250_000);
  });

  it("flags only the categories that actually overspent", () => {
    const s = summarizeBudget(categories);
    expect(s.overspentCategories.map((r) => r.category)).toEqual(["VENUE"]);
    expect(s.overBudget).toBe(false);
  });

  it("goes over budget once commitments pass the total", () => {
    const s = summarizeBudget([
      {
        category: "VENUE" as const,
        name: "Venue",
        allocatedCents: 100_000,
        items: [item(0, 250_000)],
      },
    ]);
    expect(s.overBudget).toBe(true);
    expect(s.remainingCents).toBe(-150_000);
    expect(s.percentCommitted).toBe(250);
  });

  it("handles an empty budget without dividing by zero", () => {
    const s = summarizeBudget([]);
    expect(s.percentCommitted).toBe(0);
    expect(s.committedCents).toBe(0);
    expect(s.overBudget).toBe(false);
  });

  it("does not count an unallocated category as overspent when it is empty", () => {
    const s = summarizeBudget([
      { category: "RENTALS" as const, name: "Rentals", allocatedCents: 0, items: [] },
    ]);
    expect(s.overspentCategories).toEqual([]);
    expect(s.rows[0].percentOfAllocation).toBe(0);
  });
});
