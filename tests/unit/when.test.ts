import { describe, expect, it } from "vitest";
import { formatEventDate, formatEventWhen } from "@/lib/when";

describe("formatEventWhen", () => {
  it("says the date is TBD when missing", () => {
    expect(formatEventWhen(null, 6)).toBe("6h · date TBD");
  });

  it("includes duration next to a short date", () => {
    const date = new Date("2026-09-18T12:00:00");
    expect(formatEventWhen(date, 4)).toMatch(/4h$/);
    expect(formatEventDate(date)).toMatch(/Sep/);
  });
});
