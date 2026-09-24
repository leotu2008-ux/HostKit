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

import { contactEmail, guestBookFor, inviteFromGuestBook, linkGuestsToContacts } from "@/lib/guest-book";

beforeEach(() => vi.clearAllMocks());

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
    expect(book[0]).toEqual({ id: "c2", name: "Bo", email: "bo@x.com", came: 3 });
    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.ownerId).toBe("host-1");
    expect(where.id).toEqual({ notIn: ["c-already"] });
  });

  it("counts only check-ins at events where the host ran the door, so a no-show isn't 'came'", async () => {
    mocks.guestFindMany.mockResolvedValue([]);
    mocks.eventFindMany.mockResolvedValue([{ id: "door-night" }]);
    mocks.contactFindMany.mockResolvedValue([]);

    await guestBookFor("host-1", "evt-1");

    expect(mocks.eventFindMany.mock.calls[0][0].where).toEqual({
      ownerId: "host-1",
      guests: { some: { checkedInAt: { not: null } } },
    });
    const { where, select } = mocks.contactFindMany.mock.calls[0][0];
    const came = {
      OR: [
        { checkedInAt: { not: null } },
        { rsvpStatus: "ATTENDING", eventId: { notIn: ["door-night"] }, event: expect.anything() },
      ],
    };
    expect(where.guests).toEqual({ some: { eventId: { not: "evt-1" }, ...came } });
    expect(select._count).toEqual({ select: { guests: { where: came } } });
  });

  it("doesn't count a yes to a night that hasn't happened yet, or was cancelled, as 'came'", async () => {
    mocks.guestFindMany.mockResolvedValue([]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.contactFindMany.mockResolvedValue([]);
    const now = new Date("2026-09-24T12:00:00Z");

    await guestBookFor("host-1", "evt-1", now);

    const { where, select } = mocks.contactFindMany.mock.calls[0][0];
    const happened = {
      status: { not: "CANCELLED" },
      OR: [{ endDate: null, date: { lt: now } }, { endDate: { lt: now } }],
    };
    const came = {
      OR: [{ checkedInAt: { not: null } }, { rsvpStatus: "ATTENDING", eventId: { notIn: [] }, event: happened }],
    };
    expect(where.guests).toEqual({ some: { eventId: { not: "evt-1" }, ...came } });
    expect(select._count).toEqual({ select: { guests: { where: came } } });
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
