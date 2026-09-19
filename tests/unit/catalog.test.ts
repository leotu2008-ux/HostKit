import { describe, expect, it } from "vitest";
import { ALL_EVENT_TYPES, EVENT_TYPE_OPTIONS } from "@/lib/catalog";

describe("the event type picker", () => {
  // The bug this guards: for months the intake form submitted a hardcoded
  // DINNER_PARTY, so five types shipped in #52 that no host could choose.
  // A type added to the schema must reach the picker or fail here.
  it("offers every event type exactly once", () => {
    const values = EVENT_TYPE_OPTIONS.map((o) => o.value);

    expect([...values].sort()).toEqual([...ALL_EVENT_TYPES].sort());
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every option a human label", () => {
    for (const option of EVENT_TYPE_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
      expect(option.label).not.toBe(option.value);
    }
  });

  it("leads with the types students actually host", () => {
    expect(EVENT_TYPE_OPTIONS[0].value).toBe("MIXER");
  });
});
