import { describe, expect, it } from "vitest";
import {
  BRIEF_FIELDS,
  FALLBACK_TYPE,
  UNTITLED,
  briefHash,
  briefIsComplete,
  describeMissing,
  eventTypeForKind,
  missingBriefFields,
  readyToPublish,
  type BriefFacts,
} from "@/lib/brief";
import { ALL_EVENT_TYPES, isCity } from "@/lib/catalog";

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

  it("flags city missing when blank", () => {
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

  it("treats a whitespace-only city as incomplete", () => {
    expect(missingBriefFields(complete({ city: "   " }))).toContain("city");
  });

  it("treats a one-character city as incomplete", () => {
    expect(missingBriefFields(complete({ city: "X" }))).toContain("city");
  });

  it("treats a city Hosty doesn't scout as complete", () => {
    expect(missingBriefFields(complete({ city: "Paris, FR" }))).toEqual([]);
  });

  it("treats a known city as complete", () => {
    expect(missingBriefFields(complete({ city: "New York, NY" }))).toEqual([]);
  });

  it("does not use isCity for completeness — scoutability is a separate question", () => {
    // The agent drafts a plan for any city it's given; only venue search and
    // vendor drafting need one of the four in lib/catalog.ts. If these two
    // ever agree again, the rule has regressed.
    const unscouted = "Chicago, IL";
    expect(isCity(unscouted)).toBe(false);
    expect(briefIsComplete(complete({ city: unscouted }))).toBe(true);
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
    ["networking night", "NETWORKING"],
    ["Networking mixer", "NETWORKING"],
    ["coffee chat with recruiters", "NETWORKING"],
    ["Intro to neural networks workshop", "WORKSHOP"],
    ["network security panel", "SPEAKER_EVENT"],
    ["Python workshop", "WORKSHOP"],
    ["panel on climate tech", "SPEAKER_EVENT"],
    ["fireside chat", "SPEAKER_EVENT"],
    ["guest speaker series", "SPEAKER_EVENT"],
    ["spring hackathon", "HACKATHON"],
    ["game night", "GAME_NIGHT"],
    ["pub trivia night", "GAME_NIGHT"],
    ["World Cup watch party", "WATCH_PARTY"],
    ["movie night screening", "WATCH_PARTY"],
    ["open mic night", "SHOWCASE"],
    ["talent show", "SHOWCASE"],
    ["Saturday run club", "RUN_CLUB"],
    ["sunday brunch", "DINNER_PARTY"],
    ["drama club social", "MIXER"],
    ["5k gala", "FORMAL"],
    ["raise $5k fundraiser", "FUNDRAISER"],
    ["Sunday 5k run", "RUN_CLUB"],
  ] as const)("maps %s to %s", (text, type) => {
    expect(eventTypeForKind(text)).toBe(type);
  });

  it("art show is not classified as SHOWCASE after removing it from showcase keywords", () => {
    expect(eventTypeForKind("art show")).not.toBe("SHOWCASE");
  });

  it("open mic night is still classified as SHOWCASE", () => {
    expect(eventTypeForKind("open mic night")).toBe("SHOWCASE");
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
      NETWORKING: "networking",
      WORKSHOP: "workshop",
      SPEAKER_EVENT: "panel",
      HACKATHON: "hackathon",
      GAME_NIGHT: "trivia",
      WATCH_PARTY: "watch party",
      SHOWCASE: "open mic",
      RUN_CLUB: "run club",
    };
    expect(eventTypeForKind(phrase[type])).toBe(type);
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

  it("tells a quarter hour apart from the hours either side of it", () => {
    // The duration is stringified, not rounded, so widening the column to a
    // float mustn't let 1h 30m pass for 1h or 2h and skip the agent.
    const hash = (durationHours: number) => briefHash(complete({ durationHours }));
    expect(new Set([hash(1), hash(1.25), hash(1.5), hash(1.75), hash(2)]).size).toBe(5);
  });
});
