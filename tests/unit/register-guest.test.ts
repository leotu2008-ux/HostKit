import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  guestFindFirst: vi.fn(),
  guestAggregate: vi.fn(),
  guestCreate: vi.fn(),
  guestUpdate: vi.fn(),
  notify: vi.fn(),
  link: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: vi.fn(),
    guest: {
      findFirst: mocks.guestFindFirst,
      aggregate: mocks.guestAggregate,
      create: mocks.guestCreate,
      update: mocks.guestUpdate,
    },
  };
  return {
    db: {
      ...tx,
      event: { findUnique: mocks.eventFind },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/notify", () => ({ notify: mocks.notify }));
vi.mock("@/lib/guest-book", () => ({ linkGuestsToContacts: mocks.link }));

import { registerGuest } from "@/lib/registration";

const HOUR = 3_600_000;
const VIEWER = { id: "u-9", name: "Grace", email: "grace@example.com" };

function eventAt(date: Date, status = "PUBLISHED", requiresApproval = false) {
  return {
    id: "ev-1",
    title: "Pitch Night",
    published: true,
    visibility: "UNLISTED",
    ownerId: "u-host",
    guestCount: 10,
    requiresApproval,
    date,
    endDate: null,
    durationHours: 3,
    status,
    club: null,
  };
}

describe("registerGuest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guestFindFirst.mockResolvedValue(null);
    mocks.guestAggregate.mockResolvedValue({ _count: 3, _sum: { plusOnes: 0 } });
  });

  it("saves a spot on a night still to come", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));

    const result = await registerGuest({ eventId: "ev-1", viewer: VIEWER });

    expect(result).toMatchObject({ ok: true, state: "going", changed: true });
    expect(mocks.guestCreate).toHaveBeenCalledTimes(1);
  });

  // 8 yeses bringing 2 between them fill a 10-person night.
  it("waitlists a new registration when plus-ones already fill the room", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR)));
    mocks.guestAggregate.mockResolvedValue({ _count: 8, _sum: { plusOnes: 2 } });

    const result = await registerGuest({ eventId: "ev-1", viewer: VIEWER });

    expect(result).toMatchObject({ ok: true, state: "waitlisted", changed: true });
    expect(mocks.guestCreate.mock.calls[0][0].data.rsvpStatus).toBe("WAITLISTED");
  });

  it("doesn't put anyone on the list once the night is over", async () => {
    // Someone opens last month's link and presses Register.
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() - 20 * HOUR)));

    const result = await registerGuest({ eventId: "ev-1", viewer: VIEWER });

    expect(result).toMatchObject({ ok: false, code: "closed" });
    expect(mocks.guestCreate).not.toHaveBeenCalled();
    expect(mocks.guestUpdate).not.toHaveBeenCalled();
  });

  it("doesn't ask the host to approve a request for a completed night", async () => {
    mocks.eventFind.mockResolvedValue(eventAt(new Date(Date.now() + 48 * HOUR), "COMPLETED", true));

    const result = await registerGuest({ eventId: "ev-1", viewer: VIEWER });

    expect(result).toMatchObject({ ok: false, code: "closed" });
    expect(mocks.guestCreate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
