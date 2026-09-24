import { describe, expect, it } from "vitest";
import { floating, googleCalendarUrl, icsFor } from "@/lib/calendar";

const event = {
  id: "abc123",
  title: "Pitch Night; round 2",
  date: new Date("2026-10-23T19:30:00.000Z"), // the host typed 7:30 PM
  durationHours: 3,
  city: "Boston, MA",
  address: "Olin Hall, Babson Park",
  description: "Five founders, three minutes each.",
};
const url = "https://tryhosty.app/e/abc123";

describe("floating", () => {
  it("keeps the wall-clock the host typed, no zone", () => {
    expect(floating(event.date)).toBe("20261023T193000");
  });
});

describe("icsFor", () => {
  const ics = icsFor(event, url, new Date("2026-09-11T12:00:00Z"));

  it("is a single floating-time VEVENT with the duration applied", () => {
    expect(ics).toContain("DTSTART:20261023T193000\r\n");
    expect(ics).toContain("DTEND:20261023T223000\r\n");
    expect(ics).toContain("UID:abc123@hostkit");
    expect(ics).toContain("DTSTAMP:20260911T120000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes commas and semicolons and includes the link", () => {
    expect(ics).toContain("SUMMARY:Pitch Night\\; round 2");
    expect(ics).toContain("LOCATION:Olin Hall\\, Babson Park");
    expect(ics).toContain(`URL:${url}`);
  });
});

// A date saved without a start time is stored as noon (see `parseStart`).
const dateOnly = { ...event, date: new Date("2026-10-23T12:00:00.000Z") };

describe("a date with no start time", () => {
  it("is an all-day entry in the calendar file, not noon", () => {
    const ics = icsFor(dateOnly, url, new Date("2026-09-11T12:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261023\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261024\r\n");
    expect(ics).not.toMatch(/DT(START|END):\d{8}T/);
  });

  it("is an all-day entry in the Google link, not noon", () => {
    const link = new URL(googleCalendarUrl(dateOnly, url));
    expect(link.searchParams.get("dates")).toBe("20261023/20261024");
  });

  it("still ends on the next day at the end of a month", () => {
    const ics = icsFor({ ...dateOnly, date: new Date("2026-10-31T12:00:00.000Z") }, url);
    expect(ics).toContain("DTEND;VALUE=DATE:20261101\r\n");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template link with floating dates", () => {
    const link = new URL(googleCalendarUrl(event, url));
    expect(link.hostname).toBe("calendar.google.com");
    expect(link.searchParams.get("dates")).toBe("20261023T193000/20261023T223000");
    expect(link.searchParams.get("text")).toBe("Pitch Night; round 2");
    expect(link.searchParams.get("details")).toContain(url);
  });
});
