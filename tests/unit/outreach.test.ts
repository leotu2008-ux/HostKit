import { describe, expect, it } from "vitest";
import {
  composeInquiry,
  describeDate,
  inquiryEmail,
  mailtoLink,
  normalizeRecipient,
} from "@/lib/outreach";
import type { OutreachEvent } from "@/lib/outreach";

const event = (over: Partial<OutreachEvent> = {}): OutreachEvent => ({
  title: "Sam & Ali's launch",
  type: "LAUNCH_PARTY",
  date: new Date("2026-10-23T12:00:00"),
  endDate: null,
  datesFlexible: false,
  guestCount: 90,
  durationHours: 8,
  city: "New York, NY",
  vibe: null,
  ...over,
});

const listing = { name: "The Foundry Room", category: "VENUE" as const };

describe("describeDate", () => {
  it("states a fixed date", () => {
    expect(describeDate(event())).toBe("The date is Friday, October 23, 2026");
  });

  it("gives a window when the host is flexible", () => {
    const text = describeDate(
      event({ datesFlexible: true, endDate: new Date("2026-10-30T12:00:00") }),
    );
    expect(text).toContain("to Friday, October 30, 2026");
    expect(text).toContain("flexibility");
  });

  it("is honest when there is no date yet", () => {
    expect(describeDate(event({ date: null }))).toBe(
      "We haven't locked the date yet",
    );
  });

  it("ignores a flexible flag with no end date", () => {
    expect(describeDate(event({ datesFlexible: true }))).toBe(
      "The date is Friday, October 23, 2026",
    );
  });
});

describe("composeInquiry", () => {
  it("puts everything a vendor needs to quote in the message", () => {
    const { body } = composeInquiry(event(), listing, "Dana");
    expect(body).toContain("90 guests");
    expect(body).toContain("8 hours");
    expect(body).toContain("New York, NY");
    expect(body).toContain("Friday, October 23, 2026");
    expect(body).toContain("The Foundry Room");
    expect(body.trimEnd().endsWith("Dana")).toBe(true);
  });

  it("never mentions the budget", () => {
    // Telling a vendor what you have to spend is how it becomes what you spend.
    const { body, subject } = composeInquiry(event(), listing, "Dana");
    expect(body.toLowerCase()).not.toContain("budget");
    expect(body).not.toMatch(/\$/);
    expect(subject).not.toMatch(/\$/);
  });

  it("asks venue-specific questions of a venue", () => {
    const { body } = composeInquiry(event(), listing, "Dana");
    expect(body).toContain("minimum spend");
    expect(body).toContain("access times");
  });

  it("asks catering-specific questions of a caterer", () => {
    const { body } = composeInquiry(
      event(),
      { name: "Sorrel & Ash", category: "CATERING" },
      "Dana",
    );
    expect(body).toContain("per-head cost");
    expect(body).toContain("dietary");
    expect(body).not.toContain("minimum spend");
  });

  it("falls back to generic questions for a category with none defined", () => {
    const { body } = composeInquiry(
      event(),
      { name: "Some Vendor", category: "STAFFING" },
      "Dana",
    );
    expect(body).toContain("•");
    expect(body.split("•").length).toBeGreaterThan(2);
  });

  it("includes the vibe only when the host gave one", () => {
    expect(composeInquiry(event(), listing, "Dana").body).not.toContain(
      "What we're going for",
    );
    const withVibe = composeInquiry(
      event({ vibe: "Long tables, good wine." }),
      listing,
      "Dana",
    ).body;
    expect(withVibe).toContain("What we're going for: Long tables, good wine.");
  });

  it("drops the date from the subject when there isn't one", () => {
    const { subject } = composeInquiry(event({ date: null }), listing, "Dana");
    expect(subject).toBe("Launch party inquiry — 90 guests");
  });

  it("omits 'in <city>' when the brief has no city yet", () => {
    const { body } = composeInquiry(event({ city: "" }), listing, "Dana");
    expect(body).not.toContain(" in  for");
    expect(body).not.toContain(" in ,");
    expect(body).toContain("planning a launch party for");
  });

  it("says 'a small group' instead of 'around 0 guests' when the brief has no headcount yet", () => {
    const { body } = composeInquiry(event({ guestCount: 0 }), listing, "Dana");
    expect(body).toContain("a small group");
    expect(body).not.toContain("around 0 guests");
  });
});

describe("mailtoLink", () => {
  it("encodes the subject and body", () => {
    const link = mailtoLink("Hi & hello", "line one\nline two");
    expect(link.startsWith("mailto:?subject=")).toBe(true);
    expect(link).toContain("Hi%20%26%20hello");
    expect(link).toContain("%0A");
  });
});

describe("the vendor's address", () => {
  it("trims and lowercases, so the same inbox isn't stored two ways", () => {
    expect(normalizeRecipient("  Events@Venue.COM ")).toBe("events@venue.com");
  });

  // An unsendable address must not be stored as if it were sendable: the send
  // button keys off this field being present.
  it("rejects anything that isn't an address", () => {
    expect(normalizeRecipient("not an email")).toBeNull();
    expect(normalizeRecipient("@venue.com")).toBeNull();
    expect(normalizeRecipient("events@")).toBeNull();
  });

  it("treats blank and missing as no address, not as an error", () => {
    expect(normalizeRecipient("")).toBeNull();
    expect(normalizeRecipient("   ")).toBeNull();
    expect(normalizeRecipient(null)).toBeNull();
    expect(normalizeRecipient(undefined)).toBeNull();
  });
});

describe("the email an inquiry becomes", () => {
  const args = {
    to: "events@venue.com",
    subject: "Mixer inquiry — 12 March, 300 guests",
    message: "Hello Venue,\n\nWe are planning a mixer.\n\nThanks,\nSam",
    hostEmail: "sam@startup.com",
  };

  it("sends to the vendor and replies to the host", () => {
    const email = inquiryEmail(args);

    expect(email.to).toBe("events@venue.com");
    // The whole reply-handling design rests on this: Hosty cannot read a
    // vendor's reply, so the reply must go straight to a human who can.
    expect(email.replyTo).toBe("sam@startup.com");
  });

  it("sends the host's own words, not a re-drafted message", () => {
    const email = inquiryEmail(args);

    expect(email.text).toBe(args.message);
    expect(email.subject).toBe(args.subject);
  });

  it("omits replyTo rather than inventing one when the host has no address", () => {
    const email = inquiryEmail({ ...args, hostEmail: null });

    expect(email.replyTo).toBeUndefined();
    expect(email.to).toBe("events@venue.com");
  });
});
