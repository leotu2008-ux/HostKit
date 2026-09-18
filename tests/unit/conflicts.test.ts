import { describe, expect, it } from "vitest";
import {
  CLASH_WINDOW_HOURS,
  betterNights,
  busyness,
  clashWindow,
  eveningOf,
  nightOf,
  rankNights,
  toWallClock,
  type NightLoad,
} from "@/lib/campus/conflicts";

const night = (iso: string, count: number): NightLoad => ({ night: new Date(iso), count });

describe("how busy a night is", () => {
  it("calls an empty-ish night quiet", () => {
    expect(busyness(0)).toBe("quiet");
    expect(busyness(3)).toBe("quiet");
  });

  it("calls an ordinary night normal", () => {
    // The real feed averages about ten events per school per day, so the
    // middle band has to be wide or every night reads as busy.
    expect(busyness(4)).toBe("normal");
    expect(busyness(11)).toBe("normal");
  });

  it("calls a crowded night busy", () => {
    expect(busyness(12)).toBe("busy");
    expect(busyness(147)).toBe("busy");
  });
});

describe("bridging the two time conventions", () => {
  it("keeps the wall clock the host typed", () => {
    // An Event.date is parsed in the server's zone, a campus event's startsAt
    // is wall-clock encoded as UTC. Comparing them raw moved an 8pm social to
    // the next day and pulled in every midnight all-day listing.
    const local = new Date(2026, 8, 23, 20, 0); // 23 Sep 2026, 8pm, server local
    const wall = toWallClock(local);
    expect(wall.toISOString()).toBe("2026-09-23T20:00:00.000Z");
  });

  it("does not shift the day, whatever the offset", () => {
    const lateEvening = new Date(2026, 8, 23, 23, 30);
    expect(toWallClock(lateEvening).toISOString()).toBe("2026-09-23T23:30:00.000Z");
    const earlyMorning = new Date(2026, 8, 23, 0, 30);
    expect(toWallClock(earlyMorning).toISOString()).toBe("2026-09-23T00:30:00.000Z");
  });

  it("lands the night on the day the host chose", () => {
    expect(nightOf(toWallClock(new Date(2026, 8, 23, 20, 0))).toISOString()).toBe(
      "2026-09-23T00:00:00.000Z",
    );
  });
});

describe("the clash window", () => {
  it("reaches equally either side of the proposed start", () => {
    const start = new Date("2026-09-24T20:00:00Z");
    const { from, to } = clashWindow(start);
    expect(from.toISOString()).toBe("2026-09-24T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(CLASH_WINDOW_HOURS * 2);
  });
});

describe("which night a moment belongs to", () => {
  it("opens at midnight", () => {
    expect(nightOf(new Date("2026-09-24T20:30:00Z")).toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("gives the evening slice of that night", () => {
    const { from, to } = eveningOf(new Date("2026-09-24T00:00:00Z"));
    expect(from.toISOString()).toBe("2026-09-24T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });
});

describe("ranking nights", () => {
  const loads = [
    night("2026-09-24T00:00:00Z", 14),
    night("2026-09-25T00:00:00Z", 2),
    night("2026-09-26T00:00:00Z", 2),
    night("2026-09-27T00:00:00Z", 9),
  ];

  it("puts the quietest first", () => {
    expect(rankNights(loads)[0].count).toBe(2);
  });

  it("breaks ties by the soonest, because hosts want the next good night", () => {
    const ranked = rankNights(loads);
    expect(ranked[0].night.toISOString()).toBe("2026-09-25T00:00:00.000Z");
    expect(ranked[1].night.toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  it("does not mutate what it was given", () => {
    const before = loads.map((l) => l.count);
    rankNights(loads);
    expect(loads.map((l) => l.count)).toEqual(before);
  });
});

describe("suggesting a better night", () => {
  const loads = [
    night("2026-09-24T00:00:00Z", 14),
    night("2026-09-25T00:00:00Z", 2),
    night("2026-09-26T00:00:00Z", 5),
  ];

  it("stays quiet when the chosen night is already fine", () => {
    // Nagging a host about a good decision is worse than saying nothing.
    expect(betterNights(night("2026-09-25T00:00:00Z", 2), loads)).toEqual([]);
    expect(betterNights(night("2026-09-26T00:00:00Z", 5), loads)).toEqual([]);
  });

  it("offers quieter nights when the chosen one is busy", () => {
    const out = betterNights(night("2026-09-24T00:00:00Z", 14), loads);
    expect(out).toHaveLength(2);
    expect(out[0].count).toBe(2);
    expect(out[1].count).toBe(5);
  });

  it("never offers the night already chosen", () => {
    const out = betterNights(night("2026-09-24T00:00:00Z", 14), loads);
    expect(out.some((n) => n.night.toISOString() === "2026-09-24T00:00:00.000Z")).toBe(false);
  });

  it("never offers a night that is no better", () => {
    const busyEverywhere = [night("2026-09-24T00:00:00Z", 14), night("2026-09-25T00:00:00Z", 20)];
    expect(betterNights(night("2026-09-24T00:00:00Z", 14), busyEverywhere)).toEqual([]);
  });
});
