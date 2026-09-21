import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatDurationLong,
  formatEventDate,
  formatEventWhen,
  parseStart,
  splitStart,
} from "@/lib/when";

describe("formatDuration", () => {
  it("drops the hours below one", () => {
    expect(formatDuration(0.25)).toBe("15m");
    expect(formatDuration(0.5)).toBe("30m");
    expect(formatDuration(0.75)).toBe("45m");
  });

  it("drops the minutes on a whole hour", () => {
    expect(formatDuration(1)).toBe("1h");
    expect(formatDuration(4)).toBe("4h");
    expect(formatDuration(24)).toBe("24h");
  });

  it("says both parts for a fractional hour", () => {
    expect(formatDuration(1.5)).toBe("1h 30m");
    expect(formatDuration(2.25)).toBe("2h 15m");
    expect(formatDuration(3.75)).toBe("3h 45m");
  });

  it("rounds to the nearest minute, so float noise never shows", () => {
    expect(formatDuration(3.999)).toBe("4h");
    expect(formatDuration(1.4999999)).toBe("1h 30m");
  });

  it("is 0m for nothing, less than nothing, or not a number", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-3)).toBe("0m");
    expect(formatDuration(Number.NaN)).toBe("0m");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0m");
  });
});

describe("formatDurationLong", () => {
  it("spells the units out for prose", () => {
    expect(formatDurationLong(1.5)).toBe("1 hour 30 minutes");
    expect(formatDurationLong(4)).toBe("4 hours");
    expect(formatDurationLong(0.75)).toBe("45 minutes");
  });

  it("keeps the singular singular", () => {
    expect(formatDurationLong(1)).toBe("1 hour");
    expect(formatDurationLong(1 / 60)).toBe("1 minute");
    expect(formatDurationLong(2 + 1 / 60)).toBe("2 hours 1 minute");
  });

  it("is 0 minutes for nothing at all", () => {
    expect(formatDurationLong(0)).toBe("0 minutes");
    expect(formatDurationLong(Number.NaN)).toBe("0 minutes");
  });
});

describe("formatEventWhen", () => {
  it("says the date is TBD when missing", () => {
    expect(formatEventWhen(null, 6)).toBe("6h · date TBD");
  });

  it("includes duration next to a short date", () => {
    const date = new Date("2026-09-18T12:00:00");
    expect(formatEventWhen(date, 4)).toMatch(/4h$/);
    expect(formatEventDate(date)).toMatch(/Sep/);
  });

  it("carries a fractional duration through as one phrase", () => {
    const date = new Date("2026-09-18T12:00:00");
    expect(formatEventWhen(date, 1.5)).toMatch(/1h 30m$/);
    expect(formatEventWhen(null, 0.25)).toBe("15m · date TBD");
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
