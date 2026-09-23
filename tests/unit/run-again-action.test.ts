import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  runEventAgain: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("@/lib/run-again", () => ({ runEventAgain: mocks.runEventAgain }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { runAgainAction } from "@/lib/actions/run-again";

function form(eventId: string, date: string) {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("date", date);
  return data;
}

describe("runAgainAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks access, runs the event again and opens the copy", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: "host-1" } });
    mocks.runEventAgain.mockResolvedValue("evt-2");

    await expect(runAgainAction(form("evt-1", "2026-11-05T19:00"))).rejects.toThrow("REDIRECT /events/evt-2");
    expect(mocks.requireEvent).toHaveBeenCalledWith("evt-1");
    expect(mocks.runEventAgain.mock.calls[0][0]).toBe("evt-1");
    expect(mocks.runEventAgain.mock.calls[0][1]).toBeInstanceOf(Date);
  });

  it("refuses a missing or unreadable date", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: "host-1" } });
    await expect(runAgainAction(form("evt-1", "not-a-date"))).rejects.toThrow("REDIRECT /events/evt-1/run-again?error=date");
    expect(mocks.runEventAgain).not.toHaveBeenCalled();
  });

  it("refuses an event with no host", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: null } });
    await expect(runAgainAction(form("evt-1", "2026-11-05T19:00"))).rejects.toThrow();
    expect(mocks.runEventAgain).not.toHaveBeenCalled();
  });
});
