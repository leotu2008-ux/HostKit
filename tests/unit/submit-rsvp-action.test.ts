import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  promoteWaitlist: vi.fn(),
  record: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/session", () => ({ requireEvent: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    guest: { findUnique: mocks.findUnique, update: mocks.update, count: mocks.count, aggregate: mocks.aggregate },
  },
}));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/waitlist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/waitlist")>()),
  promoteWaitlist: mocks.promoteWaitlist,
}));

import { submitRsvpAction } from "@/lib/actions/guests";

const DAY = 86_400_000;

function form(fields: Record<string, string>) {
  const data = new FormData();
  data.set("token", "tok-1");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function guest(rsvpStatus: string, event: { date: Date | null; status?: string }, plusOnes = 0) {
  return {
    id: "g-1",
    eventId: "evt-1",
    name: "Sam",
    rsvpStatus,
    plusOnes,
    event: { endDate: null, durationHours: 3, status: "PUBLISHED", guestCount: 10, ...event },
  };
}

describe("submitRsvpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({});
    mocks.count.mockResolvedValue(0);
    mocks.aggregate.mockResolvedValue({ _count: 0, _sum: { plusOnes: 0 } });
  });

  // A guest who never replied to a night the host didn't run the door for
  // would otherwise count as "came" in the guest book by tapping Going late.
  it("won't take a reply once the night is over", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() - 2 * DAY) }));

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING" }));

    expect(result).toEqual({ error: "This night has already happened." });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("won't let a yes turn into a no on a completed night", async () => {
    mocks.findUnique.mockResolvedValue(
      guest("ATTENDING", { date: new Date(Date.now() - 2 * DAY), status: "COMPLETED" }),
    );

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "DECLINED" }));

    expect(result).toEqual({ error: "This night has already happened." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("still takes a reply for a night ahead", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() + 2 * DAY) }));

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING" }));

    expect(result).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("still takes a reply for a night with no date yet", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: null }));

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "DECLINED" }));

    expect(result).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  // They gave their seat up; the people waiting were there first.
  it("sends a guest who declined to the back of the line when people are waitlisted", async () => {
    mocks.findUnique.mockResolvedValue(guest("DECLINED", { date: new Date(Date.now() + 2 * DAY) }));
    mocks.count.mockResolvedValue(2);

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING" }));

    expect(result).toBeUndefined();
    expect(mocks.count).toHaveBeenCalledWith({ where: { eventId: "evt-1", rsvpStatus: "WAITLISTED" } });
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.rsvpStatus).toBe("WAITLISTED");
    // The line is ordered by createdAt, so rejoining it now puts them last.
    expect(data.createdAt).toBeInstanceOf(Date);
    expect(Date.now() - data.createdAt.getTime()).toBeLessThan(5_000);
    expect(mocks.record).toHaveBeenCalledWith("evt-1", {
      actor: "system",
      kind: "guest_rsvp",
      title: "Sam changed their mind and joined the waitlist",
    });
  });

  it("lets a guest who declined back in when nobody is waiting", async () => {
    mocks.findUnique.mockResolvedValue(guest("DECLINED", { date: new Date(Date.now() + 2 * DAY) }));

    await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING" }));

    const data = mocks.update.mock.calls[0][0].data;
    expect(data.rsvpStatus).toBe("ATTENDING");
    expect(data.createdAt).toBeUndefined();
  });

  // The invite is the seat, even with a waitlist.
  it("keeps the seat for an invited guest while people are waitlisted", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() + 2 * DAY) }));
    mocks.count.mockResolvedValue(3);

    await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING" }));

    const data = mocks.update.mock.calls[0][0].data;
    expect(data.rsvpStatus).toBe("ATTENDING");
    expect(data.createdAt).toBeUndefined();
    expect(mocks.record).toHaveBeenCalledWith("evt-1", expect.objectContaining({ title: "Sam is going" }));
  });

  // A 10-person night with 8 others going: room for Sam and one more.
  it("won't let a guest bring more people than there's room for", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() + 2 * DAY) }));
    mocks.aggregate.mockResolvedValue({ _count: 6, _sum: { plusOnes: 2 } });

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING", plusOnes: "2" }));

    expect(result).toEqual({ error: "There’s only room for you and 1 more." });
    expect(mocks.aggregate).toHaveBeenCalledWith({
      where: { eventId: "evt-1", rsvpStatus: "ATTENDING", id: { not: "g-1" } },
      _count: true,
      _sum: { plusOnes: true },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("takes plus-ones that fit", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() + 2 * DAY) }));
    mocks.aggregate.mockResolvedValue({ _count: 6, _sum: { plusOnes: 2 } });

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING", plusOnes: "1" }));

    expect(result).toBeUndefined();
    expect(mocks.update.mock.calls[0][0].data.plusOnes).toBe(1);
  });

  it("says so when the night is full", async () => {
    mocks.findUnique.mockResolvedValue(guest("INVITED", { date: new Date(Date.now() + 2 * DAY) }));
    mocks.aggregate.mockResolvedValue({ _count: 8, _sum: { plusOnes: 1 } });

    const result = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING", plusOnes: "1" }));

    expect(result).toEqual({ error: "The night is full, so there’s only room for you." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  // Once the night fills, a guest editing their dietary note keeps the two they're bringing.
  it("keeps the plus-ones a guest already has when the night has filled", async () => {
    mocks.findUnique.mockResolvedValue(guest("ATTENDING", { date: new Date(Date.now() + 2 * DAY) }, 2));
    mocks.aggregate.mockResolvedValue({ _count: 8, _sum: { plusOnes: 0 } });

    const kept = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING", plusOnes: "2" }));
    const more = await submitRsvpAction(undefined, form({ rsvpStatus: "ATTENDING", plusOnes: "3" }));

    expect(kept).toBeUndefined();
    expect(more).toEqual({ error: "There’s only room for you and 2 more." });
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
