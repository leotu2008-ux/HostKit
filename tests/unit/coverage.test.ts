import { describe, expect, it } from "vitest";
import { computeCoverage, outstandingRequired } from "@/lib/coverage";

const inquiry = (
  status: string,
  category:
    | "VENUE"
    | "CATERING"
    | "PHOTOGRAPHY"
    | "FLORALS",
  name = `${category} co`,
  quotedCents: number | null = null,
) => ({ status, quotedCents, listing: { name, category } });

const required = ["VENUE", "CATERING"] as const;
const funded = ["VENUE", "CATERING", "FLORALS"] as const;

describe("computeCoverage", () => {
  it("lists required categories before merely funded ones", () => {
    const rows = computeCoverage([...required], [...funded], []);
    expect(rows.map((r) => r.category)).toEqual([
      "VENUE",
      "CATERING",
      "FLORALS",
    ]);
    expect(rows[2].required).toBe(false);
  });

  it("counts a booking as coverage", () => {
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("BOOKED", "VENUE", "The Foundry", 820_000)],
    );
    const venue = rows.find((r) => r.category === "VENUE")!;
    expect(venue.bookedName).toBe("The Foundry");
    expect(venue.bookedCents).toBe(820_000);
  });

  it("does NOT count a sent or quoted inquiry as coverage", () => {
    // Chasing a caterer is not the same as having one.
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("QUOTED", "CATERING")],
    );
    const catering = rows.find((r) => r.category === "CATERING")!;
    expect(catering.bookedName).toBeNull();
    expect(catering.inFlight).toBe(true);
  });

  it("stops showing in-flight once something is booked in that category", () => {
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("SENT", "VENUE", "Plan B"), inquiry("BOOKED", "VENUE", "Plan A")],
    );
    const venue = rows.find((r) => r.category === "VENUE")!;
    expect(venue.bookedName).toBe("Plan A");
    expect(venue.inFlight).toBe(false);
  });

  it("ignores a declined inquiry entirely", () => {
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("DECLINED", "VENUE")],
    );
    const venue = rows.find((r) => r.category === "VENUE")!;
    expect(venue.bookedName).toBeNull();
    expect(venue.inFlight).toBe(false);
  });
});

describe("outstandingRequired", () => {
  it("returns only required categories with nothing booked", () => {
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("BOOKED", "VENUE")],
    );
    expect(outstandingRequired(rows).map((r) => r.category)).toEqual([
      "CATERING",
    ]);
  });

  it("is empty once every required category is booked", () => {
    const rows = computeCoverage(
      [...required],
      [...funded],
      [inquiry("BOOKED", "VENUE"), inquiry("BOOKED", "CATERING")],
    );
    expect(outstandingRequired(rows)).toEqual([]);
  });
});
