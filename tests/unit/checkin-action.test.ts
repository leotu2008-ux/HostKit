import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  record: vi.fn(),
  guestFindFirst: vi.fn(),
  guestUpdate: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({
  db: { guest: { findFirst: mocks.guestFindFirst, update: mocks.guestUpdate } },
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
});

describe("checkInGuestAction", () => {
  it("checks in a guest who isn't in yet", async () => {
    mocks.guestFindFirst.mockResolvedValue(guest({ rsvpStatus: "INVITED" }));
    await checkInGuestAction(form());
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { checkedInAt: expect.any(Date), arrivedWithoutRsvp: true },
    });
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("leaves an already-admitted guest's time, walk-up flag and thread alone (a second phone's stale tap)", async () => {
    // Walked up with no reply, then the host set them to going on the Guests tab.
    mocks.guestFindFirst.mockResolvedValue(
      guest({ checkedInAt: ARRIVED, arrivedWithoutRsvp: true, rsvpStatus: "ATTENDING" }),
    );
    await checkInGuestAction(form());
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
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
    const body = await res.json();
    expect(body.guest.checkedInAt).toBe(ARRIVED.toISOString());
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
