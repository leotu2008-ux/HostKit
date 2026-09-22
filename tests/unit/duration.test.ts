import { describe, expect, it } from "vitest";
import {
  applyDurationRules,
  DEFAULT_DURATION_HOURS,
  hoursToInputValue,
  joinHours,
  MINUTE_STEPS,
  ruledOutMinutes,
  snapQuarterHours,
  splitHours,
} from "@/lib/duration";

describe("snapQuarterHours", () => {
  it("leaves a value already on the step alone", () => {
    for (const hours of [0.25, 0.5, 1, 1.5, 2.75, 6, 23.75, 24]) {
      expect(snapQuarterHours(hours)).toBe(hours);
    }
  });

  it("rounds to the nearest quarter, either way", () => {
    expect(snapQuarterHours(1.4)).toBe(1.5);
    expect(snapQuarterHours(1.12)).toBe(1);
    expect(snapQuarterHours(1.13)).toBe(1.25);
    expect(snapQuarterHours(3.999)).toBe(4);
  });

  it("clamps to the quarter hour below and the day above", () => {
    expect(snapQuarterHours(0)).toBe(0.25);
    expect(snapQuarterHours(0.1)).toBe(0.25);
    expect(snapQuarterHours(-5)).toBe(0.25);
    expect(snapQuarterHours(25)).toBe(24);
    expect(snapQuarterHours(1000)).toBe(24);
  });

  it("falls back to the default for anything that isn't a number", () => {
    expect(snapQuarterHours(Number.NaN)).toBe(DEFAULT_DURATION_HOURS);
    expect(snapQuarterHours(Number.POSITIVE_INFINITY)).toBe(DEFAULT_DURATION_HOURS);
  });
});

describe("splitHours", () => {
  it("splits a snapped value into the two drum positions", () => {
    expect(splitHours(1.5)).toEqual({ h: 1, m: 30 });
    expect(splitHours(0.25)).toEqual({ h: 0, m: 15 });
    expect(splitHours(4)).toEqual({ h: 4, m: 0 });
    expect(splitHours(2.75)).toEqual({ h: 2, m: 45 });
    expect(splitHours(24)).toEqual({ h: 24, m: 0 });
  });

  it("snaps on the way in, so a stored oddity still lands on a row", () => {
    expect(splitHours(1.4)).toEqual({ h: 1, m: 30 });
    expect(splitHours(0)).toEqual({ h: 0, m: 15 });
    expect(splitHours(99)).toEqual({ h: 24, m: 0 });
  });

  it("only ever reports a minute the drum has a row for", () => {
    for (let quarters = 1; quarters <= 96; quarters += 1) {
      expect(MINUTE_STEPS).toContain(splitHours(quarters / 4).m);
    }
  });
});

describe("joinHours", () => {
  it("is the decimal hours the column stores", () => {
    expect(joinHours(1, 30)).toBe(1.5);
    expect(joinHours(0, 15)).toBe(0.25);
    expect(joinHours(2, 45)).toBe(2.75);
    expect(joinHours(4, 0)).toBe(4);
    expect(joinHours(24, 0)).toBe(24);
  });

  it("round-trips through splitHours for every step", () => {
    for (let quarters = 1; quarters <= 96; quarters += 1) {
      const hours = quarters / 4;
      const { h, m } = splitHours(hours);
      expect(joinHours(h, m)).toBe(hours);
    }
  });
});

describe("applyDurationRules", () => {
  it("leaves the middle of the range alone", () => {
    expect(applyDurationRules(1, 30)).toEqual({ h: 1, m: 30 });
    expect(applyDurationRules(23, 45)).toEqual({ h: 23, m: 45 });
    expect(applyDurationRules(0, 15)).toEqual({ h: 0, m: 15 });
  });

  it("locks the minutes to 00 at a full day", () => {
    expect(applyDurationRules(24, 0)).toEqual({ h: 24, m: 0 });
    expect(applyDurationRules(24, 15)).toEqual({ h: 24, m: 0 });
    expect(applyDurationRules(24, 45)).toEqual({ h: 24, m: 0 });
  });

  it("keeps a quarter hour as the floor when there are no hours", () => {
    expect(applyDurationRules(0, 0)).toEqual({ h: 0, m: 15 });
  });

  it("never returns something joinHours would put off the step or out of range", () => {
    for (let h = 0; h <= 24; h += 1) {
      for (const m of MINUTE_STEPS) {
        const ruled = applyDurationRules(h, m);
        const hours = joinHours(ruled.h, ruled.m);
        expect(hours).toBe(snapQuarterHours(hours));
      }
    }
  });
});

describe("ruledOutMinutes", () => {
  it("rules out everything but 00 at a full day", () => {
    expect(ruledOutMinutes(24)).toEqual([15, 30, 45]);
  });

  it("rules out 00 when there are no hours", () => {
    expect(ruledOutMinutes(0)).toEqual([0]);
  });

  it("rules out nothing in between", () => {
    for (let h = 1; h <= 23; h += 1) {
      expect(ruledOutMinutes(h)).toEqual([]);
    }
  });

  it("agrees with applyDurationRules: a ruled-out minute is never kept", () => {
    for (let h = 0; h <= 24; h += 1) {
      for (const m of ruledOutMinutes(h)) {
        expect(applyDurationRules(h, m).m).not.toBe(m);
      }
    }
  });
});

describe("hoursToInputValue", () => {
  it("is the exact decimal, with no float noise", () => {
    expect(hoursToInputValue(1.5)).toBe("1.5");
    expect(hoursToInputValue(0.25)).toBe("0.25");
    expect(hoursToInputValue(2.75)).toBe("2.75");
    expect(hoursToInputValue(4)).toBe("4");
    expect(hoursToInputValue(24)).toBe("24");
  });

  it("is what joinHours produced, for every step the drums can reach", () => {
    for (let quarters = 1; quarters <= 96; quarters += 1) {
      const { h, m } = splitHours(quarters / 4);
      expect(hoursToInputValue(joinHours(h, m))).toBe(String(quarters / 4));
    }
  });

  it("snaps, so the hidden field can never carry an off-step value", () => {
    expect(hoursToInputValue(1.4)).toBe("1.5");
    expect(hoursToInputValue(0)).toBe("0.25");
  });
});
