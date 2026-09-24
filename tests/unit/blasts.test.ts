import { describe, expect, it } from "vitest";
import { personalize, phoneRecipientsFor, recipientsFor, segmentsFor } from "@/lib/blasts";
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

  it("everyone leaves out requesters not yet approved and the waitlist", () => {
    const list = [
      ...guests,
      { name: "Asked", email: "asked@example.com", rsvpStatus: "PENDING" as const },
      { name: "Waiting", email: "waiting@example.com", rsvpStatus: "WAITLISTED" as const },
      { name: "Unsure", email: "unsure@example.com", rsvpStatus: "MAYBE" as const },
    ];
    expect(recipientsFor("everyone", list).map((r) => r.name)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
      "Unsure",
    ]);
  });
});

describe("the came segment", () => {
  const door = [
    { name: "In", email: "in@example.com", rsvpStatus: "ATTENDING" as const, checkedInAt: new Date("2026-09-20T20:00:00Z") },
    { name: "No show", email: "noshow@example.com", rsvpStatus: "ATTENDING" as const, checkedInAt: null },
    { name: "Waiting", email: "waiting@example.com", rsvpStatus: "WAITLISTED" as const, checkedInAt: null },
  ];

  it("came = attending guests who were checked in at the door", () => {
    expect(recipientsFor("came", door).map((r) => r.name)).toEqual(["In"]);
    const phones = door.map((g) => ({ ...g, user: { phone: `+1555${g.name.length}`, phoneVerifiedAt: new Date() } }));
    expect(phoneRecipientsFor("came", phones).map((r) => r.name)).toEqual(["In"]);
  });

  const now = new Date("2026-09-24T12:00:00Z");
  const past = { date: new Date("2026-09-20T19:00:00Z"), endDate: null, status: "PLANNING" as const };

  it("is offered only for a night that happened where the door was run", () => {
    expect(segmentsFor(past, door, now)).toContain("came");
    expect(segmentsFor(past, door.map((g) => ({ ...g, checkedInAt: null })), now)).not.toContain("came");
    expect(segmentsFor({ ...past, date: new Date("2026-09-30T19:00:00Z") }, door, now)).not.toContain("came");
    expect(segmentsFor({ ...past, status: "CANCELLED" as const }, door, now)).not.toContain("came");
    expect(segmentsFor({ ...past, date: null }, door, now)).not.toContain("came");
  });

  it("waits for the last acceptable day of a flexible night", () => {
    const flexible = { ...past, endDate: new Date("2026-09-26T00:00:00Z") };
    expect(segmentsFor(flexible, door, now)).not.toContain("came");
    expect(segmentsFor({ ...flexible, endDate: new Date("2026-09-22T00:00:00Z") }, door, now)).toContain("came");
  });

  it("always offers the other segments", () => {
    expect(segmentsFor({ ...past, date: null }, [], now)).toEqual(["going", "pending", "waitlist", "everyone"]);
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
