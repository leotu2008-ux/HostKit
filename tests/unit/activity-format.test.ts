import { describe, expect, it } from "vitest";
import {
  actorLabel,
  feedIsQuiet,
  latestAt,
  mergeFeed,
  relativeTime,
  toFeedRow,
  type FeedRow,
} from "@/lib/activity-format";
import type { ActivityRow } from "@/lib/activity";

const row = (over: Partial<FeedRow> = {}): FeedRow => ({
  id: "a1",
  actor: "host",
  kind: "brief_saved",
  title: "Brief updated",
  body: null,
  href: null,
  createdAt: "2026-09-12T18:00:00.000Z",
  ...over,
});

describe("relativeTime", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");

  it("reads as just now at 0s and just under a minute", () => {
    expect(relativeTime(now.toISOString(), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() - 59_000).toISOString(), now)).toBe("just now");
  });

  it("switches to minutes at 60s", () => {
    expect(relativeTime(new Date(now.getTime() - 60_000).toISOString(), now)).toBe("1m ago");
  });

  it("stays in minutes up to 59m", () => {
    expect(relativeTime(new Date(now.getTime() - 59 * 60_000).toISOString(), now)).toBe("59m ago");
  });

  it("switches to hours at 60m", () => {
    expect(relativeTime(new Date(now.getTime() - 60 * 60_000).toISOString(), now)).toBe("1h ago");
  });

  it("stays in hours up to 23h", () => {
    expect(relativeTime(new Date(now.getTime() - 23 * 3_600_000).toISOString(), now)).toBe("23h ago");
  });

  it("reads as yesterday from 24h to 48h", () => {
    expect(relativeTime(new Date(now.getTime() - 25 * 3_600_000).toISOString(), now)).toBe("yesterday");
    expect(relativeTime(new Date(now.getTime() - 47 * 3_600_000).toISOString(), now)).toBe("yesterday");
  });

  it("falls back to a short date beyond 48h", () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000);
    expect(relativeTime(eightDaysAgo.toISOString(), now)).toBe(
      eightDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
  });
});

describe("mergeFeed", () => {
  it("dedupes by id, keeping the incoming copy", () => {
    const existing = [row({ id: "a1", title: "Old title" })];
    const incoming = [row({ id: "a1", title: "New title" })];
    const merged = mergeFeed(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("New title");
  });

  it("orders newest first", () => {
    const older = row({ id: "a1", createdAt: "2026-09-10T00:00:00.000Z" });
    const newer = row({ id: "a2", createdAt: "2026-09-15T00:00:00.000Z" });
    expect(mergeFeed([older], [newer]).map((r) => r.id)).toEqual(["a2", "a1"]);
  });

  it("tie-breaks same-instant rows by id, descending", () => {
    const same = "2026-09-15T00:00:00.000Z";
    const a = row({ id: "a1", createdAt: same });
    const b = row({ id: "a2", createdAt: same });
    expect(mergeFeed([], [a, b]).map((r) => r.id)).toEqual(["a2", "a1"]);
  });

  it("caps the result", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ id: `a${i}`, createdAt: new Date(2026, 0, i + 1).toISOString() }),
    );
    expect(mergeFeed([], rows, 3)).toHaveLength(3);
  });
});

describe("latestAt", () => {
  it("returns the max createdAt even when rows are unsorted", () => {
    const rows = [
      row({ id: "a1", createdAt: "2026-09-10T00:00:00.000Z" }),
      row({ id: "a2", createdAt: "2026-09-20T00:00:00.000Z" }),
      row({ id: "a3", createdAt: "2026-09-15T00:00:00.000Z" }),
    ];
    expect(latestAt(rows)).toBe("2026-09-20T00:00:00.000Z");
  });

  it("returns null for an empty feed", () => {
    expect(latestAt([])).toBeNull();
  });
});

describe("actorLabel", () => {
  it("covers all three actors", () => {
    expect(actorLabel("agent")).toBe("Agent");
    expect(actorLabel("host")).toBe("You");
    expect(actorLabel("system")).toBe("Hosty");
  });
});

describe("feedIsQuiet", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  const idleMs = 10 * 60_000;

  it("is true for an empty feed", () => {
    expect(feedIsQuiet([], now, idleMs)).toBe(true);
  });

  it("is false just inside the idle window", () => {
    const rows = [row({ createdAt: new Date(now.getTime() - idleMs + 1_000).toISOString() })];
    expect(feedIsQuiet(rows, now, idleMs)).toBe(false);
  });

  it("is true exactly at and beyond the idle window", () => {
    const rows = [row({ createdAt: new Date(now.getTime() - idleMs).toISOString() })];
    expect(feedIsQuiet(rows, now, idleMs)).toBe(true);
  });
});

describe("toFeedRow", () => {
  it("serialises createdAt to ISO", () => {
    const dbRow: ActivityRow = {
      id: "a1",
      actor: "host",
      kind: "brief_saved",
      title: "Brief updated",
      body: null,
      href: null,
      createdAt: new Date("2026-09-12T18:00:00.000Z"),
    };
    expect(toFeedRow(dbRow)).toEqual({
      id: "a1",
      actor: "host",
      kind: "brief_saved",
      title: "Brief updated",
      body: null,
      href: null,
      createdAt: "2026-09-12T18:00:00.000Z",
    });
  });
});
