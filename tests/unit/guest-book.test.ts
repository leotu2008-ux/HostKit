import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  eventFindMany: vi.fn(),
  guestFindMany: vi.fn(),
  guestUpdateMany: vi.fn(),
  guestCreateMany: vi.fn(),
  contactCreateMany: vi.fn(),
  contactFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mocks.eventFind, findMany: mocks.eventFindMany },
    guest: { findMany: mocks.guestFindMany, updateMany: mocks.guestUpdateMany, createMany: mocks.guestCreateMany },
    contact: { createMany: mocks.contactCreateMany, findMany: mocks.contactFindMany },
  },
}));

import {
  cameAndNew,
  contactEmail,
  guestBookFor,
  inviteFromGuestBook,
  linkGuestsToContacts,
  nightlyTurnout,
} from "@/lib/guest-book";

beforeEach(() => vi.clearAllMocks());

type NightRow = { id: string; date: Date | null; endDate: Date | null; schoolDomain: string | null };

// 19:00Z on Sep 24 is 3 PM in New York. Event dates are wall-clock times
// stored as UTC, so a 6 PM night that evening is stored as 18:00Z: before
// `now` in UTC terms, but hours ahead on the clock at the school.
const NOW = new Date("2026-09-24T19:00:00Z");
const night = (id: string, date: string, endDate: string | null = null): NightRow => ({
  id,
  date: new Date(date),
  endDate: endDate ? new Date(endDate) : null,
  schoolDomain: null,
});

/** The door-events query asks for events with a check-in; the other lists the host's nights. */
function hostEvents(doorIds: string[], nights: NightRow[]) {
  mocks.eventFindMany.mockImplementation(async ({ where }) =>
    where.guests ? doorIds.map((id) => ({ id })) : nights,
  );
}

describe("contactEmail", () => {
  it("lowercases and trims, and treats blank as none", () => {
    expect(contactEmail("  Sam@X.com ")).toBe("sam@x.com");
    expect(contactEmail("   ")).toBeNull();
    expect(contactEmail(null)).toBeNull();
  });
});

describe("linkGuestsToContacts", () => {
  it("links differently-cased emails to one contact", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: "host-1" });
    mocks.guestFindMany.mockResolvedValue([
      { id: "g1", name: "Sam", email: "Sam@X.com" },
      { id: "g2", name: "Sam O", email: "sam@x.com" },
    ]);
    mocks.contactCreateMany.mockResolvedValue({ count: 1 });
    mocks.contactFindMany.mockResolvedValue([{ id: "c1", email: "sam@x.com" }]);
    mocks.guestUpdateMany.mockResolvedValue({ count: 2 });

    const linked = await linkGuestsToContacts("evt-1");

    expect(linked).toBe(2);
    expect(mocks.contactCreateMany).toHaveBeenCalledWith({
      data: [{ ownerId: "host-1", name: "Sam", email: "sam@x.com" }],
      skipDuplicates: true,
    });
    expect(mocks.guestUpdateMany).toHaveBeenCalledWith({
      where: { eventId: "evt-1", contactId: null, id: { in: ["g1", "g2"] } },
      data: { contactId: "c1" },
    });
  });

  it("does nothing for an event with no owner", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: null });
    expect(await linkGuestsToContacts("evt-1")).toBe(0);
    expect(mocks.contactCreateMany).not.toHaveBeenCalled();
  });

  it("skips guests whose email is blank", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: "host-1" });
    mocks.guestFindMany.mockResolvedValue([{ id: "g1", name: "Sam", email: "   " }]);

    const linked = await linkGuestsToContacts("evt-1");

    expect(linked).toBe(0);
    expect(mocks.contactCreateMany).not.toHaveBeenCalled();
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
  });
});

describe("guestBookFor", () => {
  it("lists people who came before, most-attended first, excluding this event's guests", async () => {
    mocks.guestFindMany.mockResolvedValue([{ contactId: "c-already" }]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.contactFindMany.mockResolvedValue([
      { id: "c1", name: "Ana", email: "ana@x.com", _count: { guests: 1 } },
      { id: "c2", name: "Bo", email: "bo@x.com", _count: { guests: 3 } },
    ]);

    const book = await guestBookFor("host-1", "evt-1");

    expect(book.map((e) => e.id)).toEqual(["c2", "c1"]);
    expect(book[0]).toEqual({ id: "c2", name: "Bo", email: "bo@x.com", came: 3, missedOut: false });
    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.ownerId).toBe("host-1");
    expect(where.id).toEqual({ notIn: ["c-already"] });
  });

  it("counts only check-ins at events where the host ran the door, so a no-show isn't 'came'", async () => {
    mocks.guestFindMany.mockResolvedValue([]);
    hostEvents(["door-night"], [night("door-night", "2026-09-01T19:00:00Z"), night("yes-night", "2026-09-08T19:00:00Z")]);
    mocks.contactFindMany.mockResolvedValue([]);

    await guestBookFor("host-1", "evt-1", NOW);

    expect(mocks.eventFindMany).toHaveBeenCalledWith({
      where: { ownerId: "host-1", guests: { some: { checkedInAt: { not: null } } } },
      select: { id: true },
    });
    const { where, select } = mocks.contactFindMany.mock.calls[0][0];
    const came = {
      OR: [{ checkedInAt: { not: null } }, { rsvpStatus: "ATTENDING", eventId: { in: ["yes-night"] } }],
    };
    expect(where.guests).toEqual({ some: { eventId: { not: "evt-1" }, ...came } });
    expect(select._count).toEqual({ select: { guests: { where: came } } });
  });

  it("doesn't count a yes to a night that hasn't started on the school's clock, or was cancelled, as 'came'", async () => {
    mocks.guestFindMany.mockResolvedValue([]);
    hostEvents(
      [],
      [
        night("last-week", "2026-09-17T19:00:00Z"),
        night("tonight", "2026-09-24T18:00:00Z"),
        // Flexible dates: not over until the last acceptable day.
        night("flexible", "2026-09-20T12:00:00Z", "2026-09-27T12:00:00Z"),
      ],
    );
    mocks.contactFindMany.mockResolvedValue([]);

    await guestBookFor("host-1", "evt-1", NOW);

    expect(mocks.eventFindMany).toHaveBeenCalledWith({
      where: { ownerId: "host-1", status: { not: "CANCELLED" } },
      select: { id: true, date: true, endDate: true, schoolDomain: true },
    });
    const { where } = mocks.contactFindMany.mock.calls[0][0];
    expect(where.guests.some.OR[1]).toEqual({ rsvpStatus: "ATTENDING", eventId: { in: ["last-week"] } });
  });
});

describe("guestBookFor: missed out last time", () => {
  const now = NOW;

  it("puts people waitlisted at the host's last night first, even if they never came", async () => {
    mocks.guestFindMany
      .mockResolvedValueOnce([]) // on this event
      .mockResolvedValueOnce([{ contactId: "c-missed" }]); // waitlisted last time
    hostEvents([], [night("last-night", "2026-09-17T19:00:00Z")]);
    mocks.contactFindMany.mockResolvedValue([
      { id: "c-regular", name: "Ana", email: "ana@x.com", _count: { guests: 4 } },
      { id: "c-missed", name: "Zed", email: "zed@x.com", _count: { guests: 0 } },
    ]);

    const book = await guestBookFor("host-1", "evt-1", now);

    expect(book).toEqual([
      { id: "c-missed", name: "Zed", email: "zed@x.com", came: 0, missedOut: true },
      { id: "c-regular", name: "Ana", email: "ana@x.com", came: 4, missedOut: false },
    ]);
    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ guests: expect.anything() }, { id: { in: ["c-missed"] } }]);
  });

  it("looks at the host's most recent other night that happened, and only its waitlist nobody checked in from", async () => {
    mocks.guestFindMany.mockResolvedValue([]);
    hostEvents(
      [],
      [
        night("older-night", "2026-09-10T19:00:00Z"),
        night("last-night", "2026-09-17T19:00:00Z"),
        night("evt-1", "2026-09-20T19:00:00Z"),
        // Hasn't started at the school yet, so its waitlist is still live.
        night("tonight", "2026-09-24T18:00:00Z"),
      ],
    );
    mocks.contactFindMany.mockResolvedValue([]);

    await guestBookFor("host-1", "evt-1", now);

    expect(mocks.guestFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.guestFindMany.mock.calls[1][0].where).toEqual({
      eventId: "last-night",
      rsvpStatus: "WAITLISTED",
      checkedInAt: null,
      contactId: { not: null },
    });
  });

  it("doesn't flag anyone already on this event", async () => {
    mocks.guestFindMany
      .mockResolvedValueOnce([{ contactId: "c-missed" }])
      .mockResolvedValueOnce([{ contactId: "c-missed" }]);
    hostEvents([], [night("last-night", "2026-09-17T19:00:00Z")]);
    mocks.contactFindMany.mockResolvedValue([]);

    await guestBookFor("host-1", "evt-1", now);

    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ notIn: ["c-missed"] });
    expect(where.OR).toBeUndefined();
  });
});

describe("inviteFromGuestBook", () => {
  it("skips people already on the list", async () => {
    mocks.contactFindMany.mockResolvedValue([
      { id: "c1", name: "Ana", email: "ana@x.com" },
      { id: "c2", name: "Bo", email: "bo@x.com" },
      { id: "c3", name: "Cy", email: "cy@x.com" },
    ]);
    mocks.guestFindMany.mockResolvedValue([
      { contactId: "c1", email: "ana@x.com" },
      { contactId: null, email: "BO@x.com" },
    ]);

    const added = await inviteFromGuestBook("evt-1", "host-1", ["c1", "c2", "c3"]);

    expect(added).toBe(1);
    const data = mocks.guestCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ eventId: "evt-1", contactId: "c3", name: "Cy", email: "cy@x.com" });
    expect(typeof data[0].rsvpToken).toBe("string");
  });

  it("ignores contacts that belong to another host", async () => {
    mocks.contactFindMany.mockResolvedValue([]);
    mocks.guestFindMany.mockResolvedValue([]);

    expect(await inviteFromGuestBook("evt-1", "host-1", ["someone-elses"])).toBe(0);
    expect(mocks.contactFindMany.mock.calls[0][0].where).toEqual({ id: { in: ["someone-elses"] }, ownerId: "host-1" });
    expect(mocks.guestCreateMany).not.toHaveBeenCalled();
  });
});

describe("cameAndNew", () => {
  const yes = (contactId: string | null) => ({ contactId, rsvpStatus: "ATTENDING" as const, checkedInAt: null });
  const inAt = (contactId: string | null) => ({ contactId, rsvpStatus: "INVITED" as const, checkedInAt: new Date("2026-09-01T20:00:00Z") });

  it("counts who came each night and how many of them came to none of the earlier nights", () => {
    const result = cameAndNew([
      { id: "n2", date: new Date("2026-09-08"), endDate: null, guests: [yes("a"), yes("c"), yes(null)] },
      { id: "n1", date: new Date("2026-09-01"), endDate: null, guests: [yes("a"), yes("b")] },
    ]);
    expect(result.get("n1")).toEqual({ came: 2, fresh: 2 });
    // a came before; c is new; a guest with no contact came but can't be called new.
    expect(result.get("n2")).toEqual({ came: 3, fresh: 1 });
  });

  it("uses check-ins where the door was run, so a yes who never walked in didn't come", () => {
    const result = cameAndNew([
      { id: "n1", date: new Date("2026-09-01"), endDate: null, guests: [yes("a"), inAt("b")] },
      { id: "n2", date: new Date("2026-09-08"), endDate: null, guests: [yes("a")] },
    ]);
    expect(result.get("n1")).toEqual({ came: 1, fresh: 1 });
    // a never came to n1, so a is new at n2.
    expect(result.get("n2")).toEqual({ came: 1, fresh: 1 });
  });

  it("counts a contact on the list twice in one night once as new", () => {
    const result = cameAndNew([{ id: "n1", date: new Date("2026-09-01"), endDate: null, guests: [yes("a"), yes("a")] }]);
    expect(result.get("n1")).toEqual({ came: 2, fresh: 1 });
  });
});

describe("nightlyTurnout", () => {
  it("loads the host's nights that happened, with only the guests who might have come", async () => {
    const yes = { contactId: "a", rsvpStatus: "ATTENDING", checkedInAt: null };
    mocks.eventFindMany.mockResolvedValue([
      { ...night("n1", "2026-09-01T19:00:00Z"), guests: [yes] },
      // 6 PM tonight at the school, still ahead at 3 PM: no "came" yet.
      { ...night("tonight", "2026-09-24T18:00:00Z"), guests: [yes, yes] },
    ]);
    const result = await nightlyTurnout("host-1", NOW);
    expect(result.get("n1")).toEqual({ came: 1, fresh: 1 });
    expect(result.has("tonight")).toBe(false);
    const where = mocks.eventFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ ownerId: "host-1", status: { not: "CANCELLED" } });
    expect(mocks.eventFindMany.mock.calls[0][0].select.guests.where).toEqual({
      OR: [{ checkedInAt: { not: null } }, { rsvpStatus: "ATTENDING" }],
    });
  });
});
