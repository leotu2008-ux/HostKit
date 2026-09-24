import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { activity: { findMany: mocks.findMany } } }));

import { loadActivity } from "@/lib/activity";

beforeEach(() => mocks.findMany.mockReset().mockResolvedValue([]));

describe("loadActivity", () => {
  it("leaves Jev's decision rows out of the feed, in the query, so they never use up the window", async () => {
    await loadActivity("evt-1", { limit: 30 });
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ eventId: "evt-1", kind: { not: "decision" } });
    expect(query.take).toBe(30);
  });

  it("keeps the exclusion when a poll asks only for what's new", async () => {
    const after = new Date("2026-09-24T12:00:00Z");
    await loadActivity("evt-1", { after });
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({
      kind: { not: "decision" },
      createdAt: { gt: after },
    });
  });
});
