import { describe, expect, it } from "vitest";
import { personalize, recipientsFor } from "@/lib/blasts";
import { composeInquiry } from "@/lib/outreach";
import { promoBlurb } from "@/lib/promote";

const guests = [
  { name: "Ada Lovelace", email: "ada@example.com", rsvpStatus: "ATTENDING" as const },
  { name: "Grace Hopper", email: "GRACE@example.com", rsvpStatus: "INVITED" as const },
  { name: "Dup Grace", email: "grace@example.com", rsvpStatus: "ATTENDING" as const },
  { name: "Alan Turing", email: null, rsvpStatus: "ATTENDING" as const },
  { name: "Nope", email: "nope@example.com", rsvpStatus: "DECLINED" as const },
];

describe("recipientsFor", () => {
  it("going = attending guests with an email", () => {
    expect(recipientsFor("going", guests).map((r) => r.email)).toEqual([
      "ada@example.com",
      "grace@example.com",
    ]);
  });

  it("pending = invited guests only", () => {
    expect(recipientsFor("pending", guests).map((r) => r.name)).toEqual(["Grace Hopper"]);
  });

  it("everyone leaves out declines and de-duplicates by email", () => {
    const all = recipientsFor("everyone", guests);
    expect(all.map((r) => r.email)).toEqual(["ada@example.com", "grace@example.com"]);
  });
});

describe("personalize", () => {
  it("fills in a first name", () => {
    expect(personalize("Hi {name}, doors at 7.", "Ada Lovelace")).toBe("Hi Ada, doors at 7.");
  });
});

describe("composeInquiry for collaborators", () => {
  const event = {
    title: "Pitch Night",
    type: "LAUNCH_PARTY" as const,
    date: null,
    endDate: null,
    datesFlexible: false,
    guestCount: 60,
    durationHours: 3,
    city: "Boston, MA",
    vibe: null,
  };

  it("asks a speaker speaker things", () => {
    const { body } = composeInquiry(event, { name: "Dr. Q", role: "SPEAKER" }, "Sam");
    expect(body).toContain("on stage");
    expect(body).not.toContain("hire fee");
  });

  it("asks a venue venue things even without a catalog category", () => {
    const { body } = composeInquiry(event, { name: "The Roof", role: "VENUE" }, "Sam");
    expect(body).toContain("minimum spend");
  });

  it("falls back to general questions", () => {
    const { body } = composeInquiry(event, { name: "Someone" }, "Sam");
    expect(body).toContain("What would this cost");
  });
});

describe("promoBlurb", () => {
  it("puts the essentials and the link on separate lines", () => {
    const text = promoBlurb(
      {
        title: "Pitch Night",
        date: new Date("2026-10-23T19:30:00"),
        city: "Boston, MA",
        address: "Olin Hall",
        ticketType: "FREE",
        description: "Five founders, three minutes each.\nMore later.",
      },
      "https://tryhosty.app/e/abc",
    );
    expect(text.split("\n")).toEqual([
      "Pitch Night",
      "Fri, Oct 23 · 7:30 PM · Olin Hall",
      "",
      "Five founders, three minutes each.",
      "",
      "Free · register: https://tryhosty.app/e/abc",
    ]);
  });

  // A date saved without a start time is stored as noon (see `parseStart`);
  // the copy mustn't promise a noon start the host never gave.
  it("leaves the time out for a night saved without one", () => {
    const text = promoBlurb(
      {
        title: "Pitch Night",
        date: new Date("2026-10-23T12:00:00"),
        city: "Boston, MA",
        address: "Olin Hall",
        ticketType: "FREE",
        description: null,
      },
      "https://tryhosty.app/e/abc",
    );
    expect(text.split("\n")[1]).toBe("Fri, Oct 23 · Olin Hall");
  });
});
