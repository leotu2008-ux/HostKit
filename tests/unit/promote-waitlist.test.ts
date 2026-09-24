import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  guestAggregate: vi.fn(),
  guestCount: vi.fn(),
  guestFindMany: vi.fn(),
  guestFindFirst: vi.fn(),
  guestUpdate: vi.fn(),
  guestUpdateMany: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: vi.fn(),
    event: { findUnique: mocks.eventFind },
    guest: {
      aggregate: mocks.guestAggregate,
      count: mocks.guestCount,
      findMany: mocks.guestFindMany,
      findFirst: mocks.guestFindFirst,
      update: mocks.guestUpdate,
      updateMany: mocks.guestUpdateMany,
    },
  };
  return {
    db: {
      ...tx,
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/notify", () => ({ notify: mocks.notify }));

import { decideRequest, promoteWaitlist } from "@/lib/waitlist";

const HOUR = 3_600_000;
const WAITING = [
  { id: "g-1", userId: "u-1", name: "Ada", email: "ada@example.com", plusOnes: 0, createdAt: new Date(0) },
];

/** The WAITLISTED rows a `guest.count` query would find. */
function line(rows: { id: string; plusOnes: number }[]) {
  return ({ where }: { where: { plusOnes: { lte: number } } }) =>
    rows.filter((r) => r.plusOnes <= where.plusOnes.lte).length;
}

/** What the ATTENDING rows add up to: `rows` guests bringing `plusOnes` between them. */
function going(rows: number, plusOnes = 0) {
  return { _count: rows, _sum: { plusOnes } };
}

function eventAt(date: Date, status = "PUBLISHED", schoolDomain: string | null = null) {
  return { title: "Pitch Night", guestCount: 10, date, endDate: null, durationHours: 3, status, schoolDomain };
}

describe("promoteWaitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guestAggregate.mockResolvedValue(going(9));
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

  // Capacity is people in the room: 7 yeses bringing 2 between them leave one seat.
  it("counts plus-ones already going and waiting when it fills seats", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));
    mocks.guestAggregate.mockResolvedValue(going(7, 2));
    mocks.guestFindMany.mockResolvedValue([{ ...WAITING[0], plusOnes: 1 }]);

    const promoted = await promoteWaitlist("ev-1");

    expect(mocks.guestAggregate).toHaveBeenCalledWith({
      where: { eventId: "ev-1", rsvpStatus: "ATTENDING" },
      _count: true,
      _sum: { plusOnes: true },
    });
    expect(promoted).toEqual([]);
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("doesn't tell anyone they're in once the night is over", async () => {
    // The host tidies the list the morning after and marks a no-show "Not going".
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() - 20 * HOUR)));

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted).toEqual([]);
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  describe("on the school's own clock", () => {
    // Event.date is the host's wall clock encoded as UTC: 7pm reads 19:00Z.
    const SEVEN_PM = new Date("2026-09-11T19:00:00Z");

    afterEach(() => {
      vi.useRealTimers();
    });

    it("stops moving people in once the night has started", async () => {
      // A no-show marked "Not going" at 7:10pm Eastern for a 7pm start:
      // whoever's next is at home, so the host moves someone in by hand.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-11T23:10:00Z") });
      mocks.eventFind.mockResolvedValue(eventAt(SEVEN_PM));

      const promoted = await promoteWaitlist("ev-1");

      expect(promoted).toEqual([]);
      expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
      expect(mocks.notify).not.toHaveBeenCalled();
    });

    it("still moves people in that afternoon, hours before an Eastern start", async () => {
      // 3pm in Boston is 19:00Z — the same reading as the 7pm start.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-11T19:00:00Z") });
      mocks.eventFind.mockResolvedValue(eventAt(SEVEN_PM, "PUBLISHED", "babson.edu"));

      const promoted = await promoteWaitlist("ev-1");

      expect(promoted.map((g) => g.id)).toEqual(["g-1"]);
    });

    it("goes by a Pacific school's clock for a Pacific night", async () => {
      // 6:30pm in Berkeley is already 9:30pm in Boston.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-12T01:30:00Z") });
      mocks.eventFind.mockResolvedValue(eventAt(SEVEN_PM, "PUBLISHED", "berkeley.edu"));

      expect((await promoteWaitlist("ev-1")).map((g) => g.id)).toEqual(["g-1"]);

      vi.setSystemTime(new Date("2026-09-12T02:05:00Z"));
      mocks.guestUpdateMany.mockClear();

      expect(await promoteWaitlist("ev-1")).toEqual([]);
      expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    });
  });

  // Two seats free, a party of three first in line: the two behind them get in.
  it("lets smaller parties behind a party that doesn't fit into the free seats", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));
    mocks.guestAggregate.mockResolvedValue(going(8));
    mocks.guestFindMany.mockResolvedValue([
      { ...WAITING[0], id: "g-three", plusOnes: 2 },
      { ...WAITING[0], id: "g-2", createdAt: new Date(1) },
      { ...WAITING[0], id: "g-3", createdAt: new Date(2) },
    ]);

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted.map((g) => g.id)).toEqual(["g-2", "g-3"]);
  });

  // A party bigger than the whole night can never go in; everyone behind
  // them shouldn't wait forever for it.
  it("passes over a party that could never fit the night", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));
    mocks.guestAggregate.mockResolvedValue(going(8));
    mocks.guestFindMany.mockResolvedValue([
      { ...WAITING[0], id: "g-big", plusOnes: 12 },
      { ...WAITING[0], id: "g-2", createdAt: new Date(1) },
    ]);

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted.map((g) => g.id)).toEqual(["g-2"]);
  });

  it("keeps the line moving for a night with no date yet", async () => {
    mocks.eventFind.mockResolvedValue({ ...eventAt(new Date()), date: null });

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted.map((g) => g.id)).toEqual(["g-1"]);
  });

  it("doesn't promote on a night already marked completed", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR), "COMPLETED"));

    const promoted = await promoteWaitlist("ev-1");

    expect(promoted).toEqual([]);
    expect(mocks.guestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("decideRequest", () => {
  const REQUEST = { id: "g-2", userId: "u-2", name: "Lin", email: "lin@example.com", rsvpStatus: "PENDING", plusOnes: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventFind.mockResolvedValue({ title: "Pitch Night", guestCount: 10 });
    mocks.guestFindFirst.mockResolvedValue(REQUEST);
    mocks.guestCount.mockImplementation(line([]));
  });

  it("waitlists an approved request whose plus-one wouldn't fit", async () => {
    mocks.guestAggregate.mockResolvedValue(going(8, 1));

    const decided = await decideRequest("ev-1", "g-2", true);

    expect(decided?.state).toBe("waitlisted");
    expect(mocks.guestUpdate.mock.calls[0][0].data.rsvpStatus).toBe("WAITLISTED");
  });

  it("lets an approved request in with their plus-one when both fit", async () => {
    mocks.guestAggregate.mockResolvedValue(going(8));

    const decided = await decideRequest("ev-1", "g-2", true);

    expect(decided?.state).toBe("going");
    expect(mocks.guestUpdate.mock.calls[0][0].data.rsvpStatus).toBe("ATTENDING");
  });

  // Two seats free, but someone who fits them has been waiting longer.
  it("waitlists an approved request while someone waiting fits the free seats", async () => {
    mocks.guestAggregate.mockResolvedValue(going(8));
    mocks.guestCount.mockImplementation(line([{ id: "g-early", plusOnes: 0 }]));

    const decided = await decideRequest("ev-1", "g-2", true);

    expect(decided?.state).toBe("waitlisted");
  });

  // Only a party too big for the free seats is waiting, so they don't hold the request up.
  it("seats an approved request when nobody waiting fits the free seats", async () => {
    mocks.guestAggregate.mockResolvedValue(going(8));
    mocks.guestCount.mockImplementation(line([{ id: "g-big", plusOnes: 4 }]));

    const decided = await decideRequest("ev-1", "g-2", true);

    expect(decided?.state).toBe("going");
  });

  // Mid-night, auto-promotion is off and two waiters fit the seats a no-show
  // freed: the host's "Let in" picks one of them out of the line by hand.
  it("lets the host move a waitlisted guest in while others waiting fit too", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-11T23:30:00Z") });
    mocks.eventFind.mockResolvedValue({ ...eventAt(new Date("2026-09-11T19:00:00Z")), guestCount: 10 });
    mocks.guestFindFirst.mockResolvedValue({ ...REQUEST, rsvpStatus: "WAITLISTED", plusOnes: 0 });
    mocks.guestAggregate.mockResolvedValue(going(7));
    mocks.guestCount.mockImplementation(line([{ id: "g-2", plusOnes: 0 }, { id: "g-3", plusOnes: 0 }]));

    const decided = await decideRequest("ev-1", "g-2", true);
    vi.useRealTimers();

    expect(decided?.state).toBe("going");
    expect(mocks.guestUpdate.mock.calls[0][0].data.rsvpStatus).toBe("ATTENDING");
  });

  it("keeps a waitlisted guest in line when the host lets in a party that doesn't fit", async () => {
    mocks.guestFindFirst.mockResolvedValue({ ...REQUEST, rsvpStatus: "WAITLISTED", plusOnes: 2 });
    mocks.guestAggregate.mockResolvedValue(going(8));

    const decided = await decideRequest("ev-1", "g-2", true);

    expect(decided?.state).toBe("waitlisted");
  });
});
