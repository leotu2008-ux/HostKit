import { describe, expect, it } from "vitest";
import { draftToDate, formatTime, suggestRunSheet } from "@/lib/runsheet";
import { ALL_EVENT_TYPES } from "@/lib/catalog";

const wedding = { type: "WEDDING" as const, durationHours: 8 };

describe("suggestRunSheet", () => {
  it("is ordered by time", () => {
    const sheet = suggestRunSheet(wedding, [
      { category: "CATERING", name: "Sorrel & Ash" },
      { category: "FLORALS", name: "Wilder Stems" },
    ]);
    const offsets = sheet.map((i) => i.offsetMinutes);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("puts every load-in before guests arrive", () => {
    const sheet = suggestRunSheet(wedding, [
      { category: "CATERING", name: "Sorrel & Ash" },
      { category: "PHOTOGRAPHY", name: "Halliday Studio" },
    ]);
    for (const item of sheet.filter((i) => i.title.includes("load-in"))) {
      expect(item.offsetMinutes).toBeLessThan(0);
    }
  });

  it("gives the florist the room before the photographer", () => {
    // Ordering that a host would otherwise get wrong once and never again.
    const sheet = suggestRunSheet(wedding, [
      { category: "PHOTOGRAPHY", name: "Halliday Studio" },
      { category: "FLORALS", name: "Wilder Stems" },
    ]);
    const florals = sheet.findIndex((i) => i.title.startsWith("Florals"));
    const photo = sheet.findIndex((i) => i.title.startsWith("Photography"));
    expect(florals).toBeLessThan(photo);
  });

  it("names the booked vendor as the owner of their load-in", () => {
    const sheet = suggestRunSheet(wedding, [
      { category: "CATERING", name: "Sorrel & Ash" },
    ]);
    const loadIn = sheet.find((i) => i.title === "Catering load-in");
    expect(loadIn?.owner).toBe("Sorrel & Ash");
  });

  it("still produces a usable sheet with no bookings at all", () => {
    const sheet = suggestRunSheet(wedding, []);
    expect(sheet.length).toBeGreaterThan(5);
    expect(sheet.some((i) => i.title === "Guests arrive")).toBe(true);
    expect(sheet.some((i) => i.title === "Carriages")).toBe(true);
  });

  it("does not schedule the running order past the end of a short event", () => {
    // A two-hour wedding reception should not still be serving dinner.
    const sheet = suggestRunSheet({ type: "WEDDING", durationHours: 2 }, []);
    const running = sheet.filter(
      (i) => i.offsetMinutes >= 0 && i.title !== "Carriages" && !i.title.startsWith("Clear down"),
    );
    for (const item of running) {
      expect(item.offsetMinutes).toBeLessThanOrEqual(120);
    }
  });

  it("always ends with clear-down last", () => {
    const sheet = suggestRunSheet(wedding, [
      { category: "RENTALS", name: "Hudson Event Hire" },
    ]);
    expect(sheet[sheet.length - 1].title).toBe("Clear down and vendor collection");
  });

  it("builds a sheet for every event type", () => {
    for (const type of ALL_EVENT_TYPES) {
      const sheet = suggestRunSheet({ type, durationHours: 6 }, []);
      expect(sheet.length, type).toBeGreaterThan(4);
    }
  });
});

describe("draftToDate", () => {
  const date = new Date("2026-10-23T00:00:00");

  it("anchors an offset of zero to the start hour", () => {
    expect(formatTime(draftToDate(date, 15, 0))).toBe("3:00 PM");
  });

  it("handles a negative offset", () => {
    expect(formatTime(draftToDate(date, 15, -180))).toBe("12:00 PM");
  });

  it("rolls past midnight for a late finish", () => {
    const late = draftToDate(date, 19, 390);
    expect(late.getDate()).toBe(24);
    expect(formatTime(late)).toBe("1:30 AM");
  });

  it("ignores any time already on the event date", () => {
    const noon = new Date("2026-10-23T12:34:56");
    expect(formatTime(draftToDate(noon, 15, 0))).toBe("3:00 PM");
  });
});
