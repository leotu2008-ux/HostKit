import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  promoteWaitlist: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/db", () => ({
  db: { guest: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/waitlist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/waitlist")>()),
  promoteWaitlist: mocks.promoteWaitlist,
}));

import { updateGuestAction } from "@/lib/actions/guests";

function form(fields: Record<string, string>) {
  const data = new FormData();
  data.set("eventId", "evt-1");
  data.set("guestId", "g-1");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("updateGuestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1" } });
    mocks.findFirst.mockResolvedValue({ rsvpStatus: "INVITED" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  // The Guests tab's reply picker posts only the status and plus-ones, so a
  // host recording "they said yes" must not wipe the guest's allergy note.
  it("keeps the guest's dietary notes when the form doesn't carry them", async () => {
    await updateGuestAction(form({ rsvpStatus: "ATTENDING", plusOnes: "1" }));

    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = mocks.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "g-1", eventId: "evt-1" });
    expect(data).not.toHaveProperty("dietary");
    expect(data).toMatchObject({ rsvpStatus: "ATTENDING", plusOnes: 1 });
  });

  it("still saves dietary notes a form does send, and clears an empty one", async () => {
    await updateGuestAction(form({ rsvpStatus: "ATTENDING", plusOnes: "0", dietary: "  nut allergy " }));
    await updateGuestAction(form({ rsvpStatus: "ATTENDING", plusOnes: "0", dietary: "" }));

    expect(mocks.updateMany.mock.calls[0][0].data.dietary).toBe("nut allergy");
    expect(mocks.updateMany.mock.calls[1][0].data.dietary).toBeNull();
  });
});
