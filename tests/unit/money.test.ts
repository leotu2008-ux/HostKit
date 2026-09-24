import { describe, expect, it } from "vitest";
import {
  allocateCents,
  formatCents,
  formatCentsCompact,
  parseCents,
  percentOf,
} from "@/lib/money";

describe("formatCents", () => {
  it("drops cents on whole amounts", () => {
    expect(formatCents(1_200_000)).toBe("$12,000");
  });

  it("keeps cents when there is a fractional part", () => {
    expect(formatCents(1_200_050)).toBe("$12,000.50");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});

describe("formatCentsCompact", () => {
  it("leaves amounts under a thousand alone", () => {
    expect(formatCentsCompact(85_000)).toBe("$850");
  });

  it("uses one decimal below ten thousand", () => {
    expect(formatCentsCompact(420_000)).toBe("$4.2k");
  });

  it("trims a trailing zero decimal", () => {
    expect(formatCentsCompact(500_000)).toBe("$5k");
  });

  it("rounds to whole k at and above ten thousand", () => {
    expect(formatCentsCompact(1_200_000)).toBe("$12k");
  });

  it("switches to millions", () => {
    expect(formatCentsCompact(250_000_000)).toBe("$2.5M");
  });
});

describe("parseCents", () => {
  it("accepts plain numbers", () => {
    expect(parseCents("1200")).toBe(120_000);
  });

  it("strips currency symbols and separators", () => {
    expect(parseCents("$1,200.50")).toBe(120_050);
  });

  it("rounds sub-cent input rather than truncating", () => {
    expect(parseCents("10.005")).toBe(1001);
  });

  it("rejects junk", () => {
    expect(parseCents("abc")).toBeNull();
    expect(parseCents("")).toBeNull();
    expect(parseCents("12.3.4")).toBeNull();
  });

  it("rejects negatives", () => {
    expect(parseCents("-5")).toBeNull();
  });

  // Every cents column is a Postgres Int (max 2,147,483,647), and the brief and
  // inquiry actions write this result straight into one.
  it("rejects amounts over the API's $10M budget cap", () => {
    expect(parseCents("10,000,000")).toBe(1_000_000_000);
    expect(parseCents("10,000,000.01")).toBeNull();
    expect(parseCents("$25,000,000")).toBeNull();
    expect(parseCents("99999999999999999999")).toBeNull();
  });
});

describe("allocateCents", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(allocateCents(1000, [0.5, 0.5])).toEqual([500, 500]);
  });

  it("never loses or invents a cent on an awkward split", () => {
    const parts = allocateCents(1000, [1 / 3, 1 / 3, 1 / 3]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it("conserves the total across a realistic budget split", () => {
    const weights = [0.4, 0.25, 0.12, 0.1, 0.08, 0.05];
    const parts = allocateCents(2_500_000, weights);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(2_500_000);
  });

  it("handles weights that do not sum to one by normalizing", () => {
    const parts = allocateCents(900, [1, 1, 1]);
    expect(parts).toEqual([300, 300, 300]);
  });

  it("returns zeros rather than NaN when all weights are zero", () => {
    expect(allocateCents(1000, [0, 0])).toEqual([0, 0]);
  });

  it("returns an empty array for no weights", () => {
    expect(allocateCents(1000, [])).toEqual([]);
  });
});

describe("percentOf", () => {
  it("computes a rounded percentage", () => {
    expect(percentOf(250, 1000)).toBe(25);
  });

  it("treats an unallocated total as zero, not Infinity", () => {
    expect(percentOf(500, 0)).toBe(0);
  });

  it("can exceed 100 when over budget", () => {
    expect(percentOf(1500, 1000)).toBe(150);
  });
});
