import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  findMany: vi.fn(),
  createMany: vi.fn(),
  deliver: vi.fn(),
  linkGuests: vi.fn(),
  inviteFromGuestBook: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "tryhosty.app", "x-forwarded-proto": "https" }),
}));
vi.mock("@/lib/db", () => ({
  db: { guest: { findMany: mocks.findMany, createMany: mocks.createMany } },
}));
vi.mock("@/lib/guest-invite-send", () => ({
  deliverRsvpInvites: mocks.deliver,
}));
vi.mock("@/lib/guest-book", () => ({
  inviteFromGuestBook: mocks.inviteFromGuestBook,
  linkGuestsToContacts: mocks.linkGuests,
}));

import { addGuestsAction, inviteFromGuestBookAction, sendGuestInvitesAction } from "@/lib/actions/guests";

const HOST = {
  user: { id: "host-1", name: "Sam Chen", email: "sam@example.com" },
  event: {
    id: "evt-1",
    ownerId: "host-1",
    title: "Spring mixer",
    date: new Date(Date.UTC(2026, 5, 15, 23, 30)),
    budgetTotalCents: 250_000,
    ticketPriceCents: 1_500,
  },
};

function sendForm(guestId?: string) {
  const data = new FormData();
  data.set("eventId", "evt-1");
  if (guestId) data.set("guestId", guestId);
  return data;
}

describe("sendGuestInvitesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEvent.mockResolvedValue(HOST);
    mocks.deliver.mockResolvedValue({ sent: 1, skippedNoEmail: 1 });
    mocks.findMany.mockResolvedValue([
      { id: "g1", name: "Ada", email: "ada@example.com", rsvpToken: "tok-1" },
      { id: "g2", name: "No Email", email: null, rsvpToken: "tok-2" },
    ]);
  });

  it("refuses someone who isn't the host, and does not send", async () => {
    mocks.requireEvent.mockResolvedValue({
      user: { id: "other", name: "Pat", email: "pat@example.com" },
      event: HOST.event,
    });

    const result = await sendGuestInvitesAction(undefined, sendForm());

    expect(result).toEqual({ error: "Only the host can do that." });
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("refuses a draft that has no owner", async () => {
    mocks.requireEvent.mockResolvedValue({
      user: null,
      event: { ...HOST.event, ownerId: null },
    });

    const result = await sendGuestInvitesAction(undefined, sendForm());

    expect(result).toEqual({ error: "Only the host can do that." });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("sends for the owner, without handing the budget to the mailer", async () => {
    const result = await sendGuestInvitesAction(undefined, sendForm());

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt-1" },
      }),
    );
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    const payload = mocks.deliver.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Spring mixer",
      hostName: "Sam Chen",
      origin: "https://tryhosty.app",
      replyTo: "sam@example.com",
    });
    expect(payload).not.toHaveProperty("budgetTotalCents");
    expect(payload).not.toHaveProperty("ticketPriceCents");
    expect(JSON.stringify(payload)).not.toContain("250000");
    expect(JSON.stringify(payload)).not.toContain("1500");
    expect(result).toEqual({ sent: 1, skippedNoEmail: 1 });
  });

  it("only loads the guest the host asked to email", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await sendGuestInvitesAction(undefined, sendForm("missing"));

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt-1", id: "missing" },
      }),
    );
    expect(result).toEqual({ error: "That guest isn't on this list." });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});

describe("adding a guest does not email them", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEvent.mockResolvedValue(HOST);
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.linkGuests.mockResolvedValue(undefined);
    mocks.inviteFromGuestBook.mockResolvedValue(2);
  });

  it("addGuestsAction writes the rows and does not send", async () => {
    const data = new FormData();
    data.set("eventId", "evt-1");
    data.set("guests", "Ada Lovelace <ada@example.com>");

    const result = await addGuestsAction(undefined, data);

    expect(result).toEqual({ added: 1 });
    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("inviteFromGuestBookAction adds contacts and does not send", async () => {
    const data = new FormData();
    data.set("eventId", "evt-1");
    data.append("contactId", "c1");

    const result = await inviteFromGuestBookAction(undefined, data);

    expect(result).toEqual({ added: 2 });
    expect(mocks.inviteFromGuestBook).toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
