import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  guestCount: vi.fn(),
  guestFindMany: vi.fn(),
  guestUpdateMany: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: vi.fn(),
    event: { findUnique: mocks.eventFind },
    guest: { count: mocks.guestCount, findMany: mocks.guestFindMany, updateMany: mocks.guestUpdateMany },
  };
  return {
    db: {
      ...tx,
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/notify", () => ({ notify: mocks.notify }));

import { promoteWaitlist } from "@/lib/waitlist";

const HOUR = 3_600_000;
const WAITING = [
  { id: "g-1", userId: "u-1", name: "Ada", email: "ada@example.com", createdAt: new Date(0) },
];

function eventAt(date: Date, status = "PUBLISHED") {
  return { title: "Pitch Night", guestCount: 10, date, endDate: null, durationHours: 3, status };
}

describe("promoteWaitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guestCount.mockResolvedValue(9);
    mocks.guestFindMany.mockResolvedValue(WAITING);
    mocks.guestUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("lets the longest-waiting guest in when a seat frees before the night", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted.map((g) => g.id)).toEqual(["g-1"]);
    expect(mocks.guestUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it("doesn't tell anyone they're in once the night is over", async () => {
    // The host tidies the list the morning after and marks a no-show "Not going".
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() - 20 * HOUR)));

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted).toEqual([]);
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("doesn't promote on a night already marked completed", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR), "COMPLETED"));

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted).toEqual([]);
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
