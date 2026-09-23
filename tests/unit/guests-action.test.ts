import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  inviteFromGuestBook: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("@/lib/guest-book", () => ({ inviteFromGuestBook: mocks.inviteFromGuestBook }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

import { inviteFromGuestBookAction } from "@/lib/actions/guests";

function form(eventId: string, contactIds: string[]) {
  const data = new FormData();
  data.set("eventId", eventId);
  for (const id of contactIds) data.append("contactId", id);
  return data;
}

describe("inviteFromGuestBookAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invites the picked contacts for the owner", async () => {
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event: { id: "evt-1", ownerId: "host-1" } });
    mocks.inviteFromGuestBook.mockResolvedValue(2);

    const result = await inviteFromGuestBookAction(undefined, form("evt-1", ["c1", "c2"]));

    expect(mocks.inviteFromGuestBook).toHaveBeenCalledWith("evt-1", "host-1", ["c1", "c2"]);
    expect(result).toEqual({ added: 2 });
  });

  it("refuses someone who isn't the host", async () => {
    mocks.requireEvent.mockResolvedValue({ user: { id: "other" }, event: { id: "evt-1", ownerId: "host-1" } });

    const result = await inviteFromGuestBookAction(undefined, form("evt-1", ["c1"]));

    expect(result).toEqual({ error: "Only the host can do that." });
    expect(mocks.inviteFromGuestBook).not.toHaveBeenCalled();
  });

  it("refuses an event with no host", async () => {
    mocks.requireEvent.mockResolvedValue({ user: null, event: { id: "evt-1", ownerId: null } });

    const result = await inviteFromGuestBookAction(undefined, form("evt-1", ["c1"]));

    expect(result).toEqual({ error: "Only the host can do that." });
    expect(mocks.inviteFromGuestBook).not.toHaveBeenCalled();
  });
});
