import { describe, expect, it } from "vitest";
import {
  BUSY_NIGHT_THRESHOLD,
  MAYBE_SHOW_RATE,
  PRIOR_SHOW_RATE,
  PRIOR_STRENGTH,
  blendShowRate,
  confidenceFor,
  conflictMultiplier,
  predictTurnout,
  type TurnoutInput,
} from "@/lib/turnout";

/**
 * Capacity matches the heads on the list, so these cases isolate the
 * conversion rates. A capacity above the list adds the not-yet-invited, which
 * is its own behaviour and gets its own tests below.
 */
const base: TurnoutInput = {
  attendingHeads: 40,
  maybeHeads: 0,
  noReplyHeads: 0,
  capacity: 40,
  daysUntil: 10,
  conflicts: 0,
};

describe("blending history into the prior", () => {
  it("is the bare prior when nothing has finished yet", () => {
    expect(blendShowRate()).toBe(PRIOR_SHOW_RATE);
    expect(blendShowRate({ events: 0, saidYes: 0, cameThrough: 0 })).toBe(PRIOR_SHOW_RATE);
  });

  it("moves toward what actually happened, without jumping to it", () => {
    // One event where half turned up should nudge, not overturn.
    const blended = blendShowRate({ events: 1, saidYes: 40, cameThrough: 20 });
    expect(blended).toBeLessThan(PRIOR_SHOW_RATE);
    expect(blended).toBeGreaterThan(0.5);
  });

  it("is half prior, half observed at the prior's strength", () => {
    const blended = blendShowRate({ events: PRIOR_STRENGTH, saidYes: 100, cameThrough: 50 });
    expect(blended).toBeCloseTo((PRIOR_SHOW_RATE + 0.5) / 2, 5);
  });

  it("is dominated by history once there is plenty", () => {
    const blended = blendShowRate({ events: 50, saidYes: 1000, cameThrough: 500 });
    expect(blended).toBeCloseTo(0.5, 1);
  });

  it("ignores history where nobody ever said yes", () => {
    expect(blendShowRate({ events: 3, saidYes: 0, cameThrough: 0 })).toBe(PRIOR_SHOW_RATE);
  });
});

describe("a busy campus night", () => {
  it("costs a little turnout once the night is crowded", () => {
    expect(conflictMultiplier(BUSY_NIGHT_THRESHOLD)).toBeLessThan(1);
  });

  it("changes nothing on an ordinary night, or when unknown", () => {
    expect(conflictMultiplier(3)).toBe(1);
    expect(conflictMultiplier(null)).toBe(1);
    expect(conflictMultiplier(undefined)).toBe(1);
  });
});

describe("predicting the door", () => {
  it("applies the show rate to the people who said yes", () => {
    const band = predictTurnout(base);
    expect(band.expected).toBe(Math.round(40 * PRIOR_SHOW_RATE));
  });

  it("always returns a range, never a bare number", () => {
    const band = predictTurnout(base);
    expect(band.low).toBeLessThan(band.expected);
    expect(band.high).toBeGreaterThan(band.expected);
  });

  it("counts a maybe as far less than a yes", () => {
    const withMaybes = predictTurnout({ ...base, attendingHeads: 0, maybeHeads: 40, capacity: 40 });
    expect(withMaybes.expected).toBe(Math.round(40 * MAYBE_SHOW_RATE));
    expect(withMaybes.expected).toBeLessThan(predictTurnout(base).expected);
  });

  it("never promises more people than the room holds", () => {
    const band = predictTurnout({ ...base, attendingHeads: 500, capacity: 60 });
    expect(band.expected).toBe(60);
    expect(band.high).toBe(60);
  });

  it("is zero when there is nobody to come and no room to fill", () => {
    const band = predictTurnout({ ...base, attendingHeads: 0, capacity: 0 });
    expect(band.low).toBe(0);
    expect(band.expected).toBe(0);
    expect(band.high).toBe(0);
  });

  it("leans on the intake figure while the list is still short", () => {
    // A night planned for 60 with three names on it is not a night for two
    // people — this read 0-0 on screen before the fix.
    const band = predictTurnout({
      ...base,
      attendingHeads: 0,
      noReplyHeads: 3,
      capacity: 60,
    });
    expect(band.expected).toBeGreaterThan(30);
    expect(band.basis.join(" ")).toContain("still to be invited");
  });

  it("stops leaning on it once the list is full", () => {
    const band = predictTurnout({ ...base, attendingHeads: 40, capacity: 40 });
    expect(band.basis.join(" ")).not.toContain("still to be invited");
  });

  it("predicts fewer on a busy night than a quiet one", () => {
    const quiet = predictTurnout({ ...base, conflicts: 2 });
    const busy = predictTurnout({ ...base, conflicts: 40 });
    expect(busy.expected).toBeLessThan(quiet.expected);
  });

  it("says out loud that it is guessing when it has no history", () => {
    const band = predictTurnout(base);
    expect(band.basis.join(" ")).toContain("No finished events yet");
  });

  it("explains itself from history once it has some", () => {
    const band = predictTurnout({
      ...base,
      history: { events: 6, saidYes: 120, cameThrough: 72 },
    });
    expect(band.basis.join(" ")).toContain("6 finished events");
  });

  it("says when it has hit the capacity ceiling", () => {
    const band = predictTurnout({ ...base, attendingHeads: 500, capacity: 60 });
    expect(band.basis.join(" ")).toContain("Capped at your capacity");
  });

  it("doesn't claim a cap when the estimate lands exactly on capacity", () => {
    // 160 maybes at a quarter each is 40, the capacity, with nothing cut off.
    const band = predictTurnout({ ...base, attendingHeads: 0, maybeHeads: 160 });
    expect(band.expected).toBe(40);
    expect(band.basis.join(" ")).not.toContain("Capped");
  });

  it("says a busy night is nearby, not on campus", () => {
    const band = predictTurnout({ ...base, conflicts: 40 });
    expect(band.basis.join(" ")).toContain("a busy night nearby");
    expect(band.basis.join(" ")).not.toContain("campus");
  });
});

describe("how sure it is", () => {
  it("is unsure with no history and no replies", () => {
    expect(confidenceFor({ ...base, attendingHeads: 0, noReplyHeads: 40 })).toBe("low");
  });

  it("firms up once history exists", () => {
    expect(confidenceFor({ ...base, history: { events: 3, saidYes: 60, cameThrough: 40 } })).toBe(
      "medium",
    );
  });

  it("is most sure with history, replies in, and the night close", () => {
    expect(
      confidenceFor({
        ...base,
        daysUntil: 3,
        attendingHeads: 40,
        noReplyHeads: 5,
        history: { events: 8, saidYes: 200, cameThrough: 130 },
      }),
    ).toBe("high");
  });

  it("narrows the band as it grows more sure", () => {
    const unsure = predictTurnout({ ...base, attendingHeads: 40, noReplyHeads: 40 });
    const sure = predictTurnout({
      ...base,
      daysUntil: 2,
      attendingHeads: 40,
      noReplyHeads: 2,
      history: { events: 9, saidYes: 300, cameThrough: 200 },
    });
    expect(sure.high - sure.low).toBeLessThan(unsure.high - unsure.low);
  });
});
