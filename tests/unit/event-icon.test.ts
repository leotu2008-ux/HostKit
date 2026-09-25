import { describe, expect, it } from "vitest";
import { DEFAULT_ICON, iconFor, type EventIcon } from "@/lib/event-icon";
import { ALL_EVENT_TYPES } from "@/lib/catalog";

/**
 * Every title below is a real one, taken from the synced campus feed, so the
 * categories are answering the data rather than the other way round.
 */
const REAL: Array<[string, EventIcon]> = [
  ["Men's Soccer vs Lehigh", "athletics"],
  ["Women's Basketball vs Marshall", "athletics"],
  ["Wrestling vs Petrofes Invitational (Host: Messiah University) - Day One", "athletics"],
  ["Princeton University Men's Cross Country vs Ivy League Heptagonal Championships", "athletics"],
  ["Brown University Women's Swimming & Diving vs Bruno Invitational", "athletics"],
  ["California Men's Soccer at San Francisco", "athletics"],
  ["Vanderbilt Cube Club Biweekly GBM", "meeting"],
  ["Weekly Model UN Meeting", "meeting"],
  ["Sports Staff Meeting", "meeting"],
  ["ALDPES Tabling Event", "meeting"],
  ["Laboratory Medicine Grand Rounds: TBA", "talk"],
  ["Immunology Seminar Series - Ai Ing Lim, PhD", "talk"],
  ["Political Science Info Session", "talk"],
  ["Lecture—“Managing a World Class Business”", "talk"],
  ["Supplemental Learning Group - Organic Chemistry I (Angelo)", "study"],
  ["Japanese Tutoring", "study"],
  ["Korean Language Table", "study"],
  ["ICCF Weekly Bible Study", "worship"],
  ["Jummah Prayers", "worship"],
  ["Virtual Weight Training Class with The Whole U", "fitness"],
  ["Women & Non-Binary Climb Night", "fitness"],
  ["Learn to Belay", "fitness"],
  ["Dance 2XS Incorporated, Regular Weekly Practices Fall 2026 Pt. 1", "stage"],
  ["Out After Dark: Exhibition by Tamara Santibañez", "arts"],
  ["Open Studio", "arts"],
  ["Semester Planning + Pizza with the Educational Resource Center", "food"],
  ["Picnic with the American Cancer Society", "food"],
  ["Stargazing", "outdoors"],
  ["Rivanna River Round-Up", "outdoors"],
  ["Deadline: Last day to withdraw from the university with a 60% refund of tuition", "deadline"],
];

describe("what a title says about an event", () => {
  for (const [title, expected] of REAL) {
    it(`reads "${title.slice(0, 44)}" as ${expected}`, () => {
      expect(iconFor({ title })).toBe(expected);
    });
  }
});

describe("falling back", () => {
  it("gives up gracefully on a title that says nothing", () => {
    expect(iconFor({ title: "Rehersal2" })).toBe(DEFAULT_ICON);
    expect(iconFor({ title: "Spatial Sandboxing" })).toBe(DEFAULT_ICON);
    expect(iconFor({ title: "First APM" })).toBe(DEFAULT_ICON);
  });

  it("handles an empty or missing title", () => {
    expect(iconFor({ title: "" })).toBe(DEFAULT_ICON);
    expect(iconFor({})).toBe(DEFAULT_ICON);
    expect(iconFor({ title: null })).toBe(DEFAULT_ICON);
  });

  it("reads the host when the title alone gives nothing away", () => {
    expect(iconFor({ title: "Weekly", host: "Concert Band" })).toBe("stage");
  });
});

describe("Hosty's own events", () => {
  it("trusts the event type over the words", () => {
    // "Soccer Season Kickoff" would read as athletics from its title alone.
    expect(iconFor({ title: "Soccer Season Kickoff", type: "DINNER_PARTY" })).toBe("food");
    expect(iconFor({ title: "Anything", type: "BIRTHDAY" })).toBe("celebration");
    expect(iconFor({ title: "Anything", type: "FUNDRAISER" })).toBe("giving");
    expect(iconFor({ title: "Anything", type: "CORPORATE_OFFSITE" })).toBe("career");
  });

  it("falls back to the title for a type it doesn't know", () => {
    expect(iconFor({ title: "Gallery Night", type: "SOMETHING_NEW" })).toBe("arts");
  });

  it.each(ALL_EVENT_TYPES)("gives %s its own icon, whatever the title says", (type) => {
    expect(iconFor({ type, title: "" })).not.toBe(DEFAULT_ICON);
  });

  it("draws a run club as fitness and a showcase as a stage", () => {
    expect(iconFor({ type: "RUN_CLUB" })).toBe("fitness");
    expect(iconFor({ type: "SHOWCASE" })).toBe("stage");
  });
});

describe("ordering", () => {
  it("prefers the more specific rule when two could match", () => {
    // Both "career fair" and "fair" are meeting-ish words; career wins.
    expect(iconFor({ title: "Fall Career Fair" })).toBe("career");
    // A club fair is a gathering, not a job hunt.
    expect(iconFor({ title: "Fall Club Fair" })).toBe("meeting");
    // A deadline that mentions a sport is still a deadline? No — athletics
    // leads deliberately, and this documents that choice.
    expect(iconFor({ title: "Soccer roster deadline" })).toBe("athletics");
  });
});
