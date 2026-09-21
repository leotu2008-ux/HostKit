import { describe, expect, it } from "vitest";
import { formatEventDate, formatEventWhen, parseStart, splitStart } from "@/lib/when";

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

describe("splitStart", () => {
  it("is empty for no date", () => {
    expect(splitStart(null)).toEqual({ date: "", time: "" });
  });

  it("round-trips through parseStart", () => {
    const start = parseStart("2026-11-03", "18:00");
    expect(splitStart(start)).toEqual({ date: "2026-11-03", time: "18:00" });
  });

  it("pads single-digit months, days, hours and minutes", () => {
    const start = parseStart("2026-01-05", "09:05");
    expect(splitStart(start)).toEqual({ date: "2026-01-05", time: "09:05" });
  });
});
