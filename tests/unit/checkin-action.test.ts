import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  record: vi.fn(),
  guestFindFirst: vi.fn(),
  guestUpdate: vi.fn(),
  guestUpdateMany: vi.fn(),
  guestFindUnique: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({
  db: {
    guest: {
      findFirst: mocks.guestFindFirst,
      findUnique: mocks.guestFindUnique,
      update: mocks.guestUpdate,
      updateMany: mocks.guestUpdateMany,
    },
  },
}));
vi.mock("@/lib/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/http")>();
  return {
    ...actual,
    apiUser: vi.fn(async () => ({ id: "u1", name: "Maya" })),
    manageableEvent: vi.fn(async () => ({ id: "e1", ownerId: "u1" })),
  };
});

import { checkInGuestAction } from "@/lib/actions/checkin";
import { POST } from "@/app/api/v1/events/[id]/guests/[guestId]/check-in/route";

const ARRIVED = new Date("2026-10-23T23:30:00Z");

function guest(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    name: "Sam",
    email: null,
    rsvpStatus: "ATTENDING",
    plusOnes: 0,
    checkedInAt: null,
    arrivedWithoutRsvp: false,
    ...overrides,
  };
}

function form() {
  const data = new FormData();
  data.set("eventId", "e1");
  data.set("guestId", "g1");
  return data;
}

function post(checkedIn: boolean) {
  return POST(
    new Request("http://localhost/api/v1/events/e1/guests/g1/check-in", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ checkedIn }),
    }),
    { params: Promise.resolve({ id: "e1", guestId: "g1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireEvent.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1", ownerId: "u1" } });
  mocks.guestUpdate.mockImplementation(async ({ data }) => guest(data));
  mocks.guestUpdateMany.mockResolvedValue({ count: 1 });
});

/**
 * Two doors tapping the same guest at the same moment: both reads see them
 * not in yet, then both write. The row honours `checkedInAt: null` in a
 * where, the way Postgres does, and counts the writes that landed.
 */
function raceRow() {
  const row = guest();
  const landed: Date[] = [];
  const write = async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    if (where.checkedInAt === null && row.checkedInAt) return { count: 0 };
    Object.assign(row, data);
    if (data.checkedInAt) landed.push(data.checkedInAt as Date);
    return { count: 1 };
  };
  mocks.guestFindFirst.mockResolvedValue(guest());
  mocks.guestFindUnique.mockImplementation(async () => ({ ...row }));
  mocks.guestUpdate.mockImplementation(async (args) => (await write(args), { ...row }));
  mocks.guestUpdateMany.mockImplementation(write);
  return { row, landed };
}

describe("checkInGuestAction", () => {
  it("checks in a guest who isn't in yet", async () => {
    mocks.guestFindFirst.mockResolvedValue(guest({ rsvpStatus: "INVITED" }));
    await checkInGuestAction(form());
    expect(mocks.guestUpdateMany).toHaveBeenCalledWith({
      where: { id: "g1", eventId: "e1", checkedInAt: null },
      data: { checkedInAt: expect.any(Date), arrivedWithoutRsvp: true },
    });
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("admits a guest once when two phones tap Check in at the same moment", async () => {
    const { landed } = raceRow();
    await Promise.all([checkInGuestAction(form()), checkInGuestAction(form())]);
    expect(landed).toHaveLength(1);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("leaves an already-admitted guest's time, walk-up flag and thread alone (a second phone's stale tap)", async () => {
    // Walked up with no reply, then the host set them to going on the Guests tab.
    mocks.guestFindFirst.mockResolvedValue(
      guest({ checkedInAt: ARRIVED, arrivedWithoutRsvp: true, rsvpStatus: "ATTENDING" }),
    );
    await checkInGuestAction(form());
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    // …but that phone's list still flips to "Already in".
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe("POST /api/v1/events/:id/guests/:guestId/check-in", () => {
  it("returns an already-admitted guest unchanged instead of re-stamping them", async () => {
    mocks.guestFindFirst.mockResolvedValue(
      guest({ checkedInAt: ARRIVED, arrivedWithoutRsvp: true, rsvpStatus: "ATTENDING" }),
    );
    const res = await post(true);
    expect(res.status).toBe(200);
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.guest.checkedInAt).toBe(ARRIVED.toISOString());
  });

  it("keeps the first arrival when two devices check the same guest in at once", async () => {
    const { landed } = raceRow();
    const [a, b] = await Promise.all([post(true), post(true)]);
    expect(landed).toHaveLength(1);
    const times = [(await a.json()).guest.checkedInAt, (await b.json()).guest.checkedInAt];
    expect(times).toEqual([landed[0].toISOString(), landed[0].toISOString()]);
  });

  it("still undoes a check-in", async () => {
    mocks.guestFindFirst.mockResolvedValue(guest({ checkedInAt: ARRIVED, arrivedWithoutRsvp: true }));
    const res = await post(false);
    expect(res.status).toBe(200);
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { checkedInAt: null, arrivedWithoutRsvp: false },
    });
  });
});
