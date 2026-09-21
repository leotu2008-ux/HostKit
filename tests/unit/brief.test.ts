import { describe, expect, it } from "vitest";
import {
  BRIEF_FIELDS,
  FALLBACK_TYPE,
  UNTITLED,
  briefHash,
  briefIsComplete,
  briefKindLabel,
  describeMissing,
  eventTypeForKind,
  missingBriefFields,
  readyToPublish,
  type BriefFacts,
} from "@/lib/brief";
import { ALL_EVENT_TYPES } from "@/lib/catalog";

/** A brief with every field filled in — flip one field at a time from here. */
const complete = (over: Partial<BriefFacts> = {}): BriefFacts => ({
  title: "Sam's launch",
  kind: "Launch party",
  type: "LAUNCH_PARTY",
  date: new Date("2026-10-23T19:00:00"),
  durationHours: 6,
  city: "New York, NY",
  guestCount: 90,
  budgetTotalCents: 500_000,
  vibe: null,
  description: null,
  ...over,
});

/** The row schema defaults actually produce for a brand-new blank event. */
const blank: BriefFacts = {
  title: UNTITLED,
  kind: null,
  type: FALLBACK_TYPE,
  date: null,
  durationHours: 6,
  city: "",
  guestCount: 0,
  budgetTotalCents: 0,
  vibe: null,
  description: null,
};

describe("missingBriefFields", () => {
  it("lists every field, in BRIEF_FIELDS order, for a blank event", () => {
    expect(missingBriefFields(blank)).toEqual(["kind", "date", "city", "guests", "budget"]);
    expect(briefIsComplete(blank)).toBe(false);
  });

  it("returns nothing missing for a complete brief", () => {
    expect(missingBriefFields(complete())).toEqual([]);
    expect(briefIsComplete(complete())).toBe(true);
  });

  it("flags kind missing when blank", () => {
    expect(missingBriefFields(complete({ kind: null }))).toEqual(["kind"]);
  });

  it("flags date missing when null", () => {
    expect(missingBriefFields(complete({ date: null }))).toEqual(["date"]);
  });

  it("flags city missing when not a known city", () => {
    expect(missingBriefFields(complete({ city: "" }))).toEqual(["city"]);
  });

  it("flags guests missing when zero", () => {
    expect(missingBriefFields(complete({ guestCount: 0 }))).toEqual(["guests"]);
  });

  it("flags budget missing when zero", () => {
    expect(missingBriefFields(complete({ budgetTotalCents: 0 }))).toEqual(["budget"]);
  });

  it("treats 0 guests as incomplete", () => {
    expect(missingBriefFields(complete({ guestCount: 0 }))).toContain("guests");
  });

  it("treats -1 guests as incomplete", () => {
    expect(missingBriefFields(complete({ guestCount: -1 }))).toContain("guests");
  });

  it("treats 1.5 guests as incomplete", () => {
    expect(missingBriefFields(complete({ guestCount: 1.5 }))).toContain("guests");
  });

  it("treats 1 guest as complete", () => {
    expect(missingBriefFields(complete({ guestCount: 1 }))).toEqual([]);
  });

  it("treats a zero budget as incomplete", () => {
    expect(missingBriefFields(complete({ budgetTotalCents: 0 }))).toContain("budget");
  });

  it("treats a $0.01 budget as complete", () => {
    expect(missingBriefFields(complete({ budgetTotalCents: 1 }))).toEqual([]);
  });

  it("treats an empty city as incomplete", () => {
    expect(missingBriefFields(complete({ city: "" }))).toContain("city");
  });

  it("treats a city not in the catalog as incomplete", () => {
    expect(missingBriefFields(complete({ city: "Paris, FR" }))).toContain("city");
  });

  it("treats a known city as complete", () => {
    expect(missingBriefFields(complete({ city: "New York, NY" }))).toEqual([]);
  });

  it("treats whitespace-only kind as incomplete", () => {
    expect(missingBriefFields(complete({ kind: "   " }))).toContain("kind");
  });

  it("treats a padded kind as complete", () => {
    expect(missingBriefFields(complete({ kind: " Mixer " }))).toEqual([]);
  });

  it("treats an invalid date as incomplete", () => {
    expect(missingBriefFields(complete({ date: new Date("nope") }))).toContain("date");
  });
});

describe("readyToPublish", () => {
  it("is false while the title is still the placeholder, even complete", () => {
    expect(readyToPublish(complete({ title: UNTITLED }))).toBe(false);
  });

  it("is false for a blank/whitespace title", () => {
    expect(readyToPublish(complete({ title: "  " }))).toBe(false);
  });

  it("is true once renamed and complete", () => {
    expect(readyToPublish(complete())).toBe(true);
  });

  it("is false when the brief is incomplete, even with a real title", () => {
    expect(readyToPublish(complete({ city: "" }))).toBe(false);
  });
});

describe("describeMissing", () => {
  it("is blank for nothing missing", () => {
    expect(describeMissing([])).toBe("");
  });

  it("names one field", () => {
    expect(describeMissing(["date"])).toBe("a date");
  });

  it("joins two fields with 'and'", () => {
    expect(describeMissing(["date", "city"])).toBe("a date and a city");
  });

  it("joins three-plus fields with a serial comma before 'and'", () => {
    expect(describeMissing(["date", "city", "budget"])).toBe("a date, a city and a budget");
  });

  it("labels every BRIEF_FIELDS entry", () => {
    expect(describeMissing([...BRIEF_FIELDS])).toBe(
      "a kind of event, a date, a city, a headcount and a budget",
    );
  });
});

describe("eventTypeForKind", () => {
  it.each([
    ["Demo day", "PITCH_NIGHT"],
    ["launch party", "LAUNCH_PARTY"],
    ["birthday dinner", "BIRTHDAY"],
    ["GBM", "GENERAL_MEETING"],
    ["BLACK-TIE gala!!", "FORMAL"],
  ] as const)("maps %s to %s", (text, type) => {
    expect(eventTypeForKind(text)).toBe(type);
  });

  it.each([["silent disco"], [""]] as const)("returns null for %s", (text) => {
    expect(eventTypeForKind(text)).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(eventTypeForKind(null)).toBeNull();
    expect(eventTypeForKind(undefined)).toBeNull();
  });

  it.each(ALL_EVENT_TYPES)("every EventType is reachable from at least one phrase (%s)", (type) => {
    // Table-driven: one representative phrase per type, taken straight off
    // the keyword table, so a type can never go silently unreachable.
    const phrase: Record<(typeof ALL_EVENT_TYPES)[number], string> = {
      PITCH_NIGHT: "pitch",
      FORMAL: "formal",
      FUNDRAISER: "fundraiser",
      STUDY_BREAK: "study break",
      LAUNCH_PARTY: "launch",
      BIRTHDAY: "birthday",
      CORPORATE_OFFSITE: "offsite",
      GENERAL_MEETING: "gbm",
      DINNER_PARTY: "dinner",
      MIXER: "mixer",
    };
    expect(eventTypeForKind(phrase[type])).toBe(type);
  });
});

describe("briefKindLabel", () => {
  it("prefers the host's own words", () => {
    expect(briefKindLabel({ kind: " Silent disco fundraiser ", type: "MIXER" })).toBe(
      "Silent disco fundraiser",
    );
  });

  it("falls back to the type label when there's no kind", () => {
    expect(briefKindLabel({ kind: null, type: "MIXER" })).toBe("Mixer");
  });

  it("falls back when kind is blank", () => {
    expect(briefKindLabel({ kind: "   ", type: "DINNER_PARTY" })).toBe("Dinner party");
  });
});

describe("briefHash", () => {
  it("is stable for identical facts", () => {
    expect(briefHash(complete())).toBe(briefHash(complete()));
  });

  it("is 16 hex characters", () => {
    expect(briefHash(complete())).toMatch(/^[0-9a-f]{16}$/);
  });

  it.each([
    ["title", { title: "Different title" }],
    ["kind", { kind: "Different kind" }],
    ["type", { type: "MIXER" as const }],
    ["date", { date: new Date("2026-11-01T12:00:00") }],
    ["durationHours", { durationHours: 8 }],
    ["city", { city: "Boston, MA" }],
    ["guestCount", { guestCount: 200 }],
    ["budgetTotalCents", { budgetTotalCents: 1 }],
    ["vibe", { vibe: "Chill" }],
    ["description", { description: "New description" }],
  ] as const)("changes when %s changes", (_field, over) => {
    expect(briefHash(complete(over as Partial<BriefFacts>))).not.toBe(briefHash(complete()));
  });
});
