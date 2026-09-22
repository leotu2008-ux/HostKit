import { describe, expect, it } from "vitest";
import type { BriefFacts } from "@/lib/brief";
import {
  planSteps,
  skippedSteps,
  vendorCategories,
  type StepContext,
} from "@/lib/agent/steps";

/** A brief with every fact filled in — briefIsComplete's happy case. */
const brief: BriefFacts = {
  title: "Sam & Ali's supper",
  kind: "dinner party",
  type: "DINNER_PARTY",
  date: new Date("2026-06-01T18:00:00"),
  durationHours: 6,
  city: "New York, NY",
  guestCount: 90,
  budgetTotalCents: 4_800_000,
  vibe: null,
  description: null,
};

/** A blank event's context: nothing drafted, nothing booked, search on. */
const nothingDone: StepContext = {
  hasPlan: false,
  hasVenue: false,
  venueSearchConfigured: true,
  cityIsScoutable: true,
  plannedCategories: [],
  categoriesWithInquiry: [],
};

const names = (context: StepContext, facts: BriefFacts = brief) =>
  planSteps(facts, context).map((step) => step.name);

const whyFor = (name: string, context: StepContext, facts: BriefFacts = brief) =>
  skippedSteps(facts, context).find((step) => step.name === name)?.why;

describe("planSteps — a complete brief on a blank event", () => {
  it("runs all three, plan then venues then vendors", () => {
    expect(names(nothingDone)).toEqual(["plan", "venues", "vendors"]);
  });

  it("skips nothing", () => {
    expect(skippedSteps(brief, nothingDone)).toEqual([]);
  });
});

describe("planSteps — the venue step", () => {
  it("doesn't look when the event already has a venue", () => {
    const context = { ...nothingDone, hasVenue: true };
    expect(names(context)).toEqual(["plan", "vendors"]);
    expect(whyFor("venues", context)).toBe("you already have a venue");
  });

  it("doesn't look when venue search isn't configured", () => {
    const context = { ...nothingDone, venueSearchConfigured: false };
    expect(names(context)).toEqual(["plan", "vendors"]);
    expect(whyFor("venues", context)).toBe("venue search isn't switched on here");
  });

  it("doesn't look without a headcount, and says which is missing", () => {
    const context = nothingDone;
    const facts = { ...brief, guestCount: 0 };
    expect(names(context, facts)).toEqual(["plan", "vendors"]);
    expect(whyFor("venues", context, facts)).toBe("add a headcount first");
  });

  it("prefers the strongest reason when several apply", () => {
    // Having a venue makes every other reason moot — the host isn't waiting
    // on a search at all.
    const context = { ...nothingDone, hasVenue: true, venueSearchConfigured: false };
    expect(whyFor("venues", context)).toBe("you already have a venue");
  });
});

describe("planSteps — a city Hosty doesn't scout", () => {
  it("runs neither venues nor vendors, and says why for both", () => {
    const context = { ...nothingDone, cityIsScoutable: false };
    expect(names(context)).toEqual(["plan"]);
    expect(whyFor("venues", context)).toBe("Hosty doesn't scout that city yet");
    expect(whyFor("vendors", context)).toBe("Hosty doesn't scout that city yet");
  });
});

describe("planSteps — the plan step", () => {
  it("doesn't run without a budget to split", () => {
    // With no plan coming, the vendor step has no categories to shop for
    // either — the venue search is all a budget-less brief supports.
    const facts = { ...brief, budgetTotalCents: 0 };
    expect(names(nothingDone, facts)).toEqual(["venues"]);
    expect(whyFor("plan", nothingDone, facts)).toBe("there's no budget to split yet");
  });

  it("reads as a first draft when there's no plan yet", () => {
    expect(planSteps(brief, nothingDone)[0]).toEqual({ name: "plan", reason: "no plan yet" });
  });

  it("reads as a redraft once a plan exists", () => {
    const context = { ...nothingDone, hasPlan: true, plannedCategories: ["CATERING" as const] };
    expect(planSteps(brief, context)[0]).toEqual({ name: "plan", reason: "the brief changed" });
  });
});

describe("vendorCategories", () => {
  it("keeps the planned order", () => {
    expect(
      vendorCategories({
        ...nothingDone,
        plannedCategories: ["CATERING", "FLORALS", "BAR_SERVICE"],
      }),
    ).toEqual(["CATERING", "FLORALS", "BAR_SERVICE"]);
  });

  it("drops a category that already has an inquiry", () => {
    expect(
      vendorCategories({
        ...nothingDone,
        plannedCategories: ["CATERING", "FLORALS"],
        categoriesWithInquiry: ["CATERING"],
      }),
    ).toEqual(["FLORALS"]);
  });

  it("never includes VENUE — the venue step owns that one", () => {
    expect(
      vendorCategories({
        ...nothingDone,
        plannedCategories: ["VENUE", "CATERING"],
      }),
    ).toEqual(["CATERING"]);
  });
});

describe("planSteps — the vendor step", () => {
  it("doesn't draft when every category already has an inquiry", () => {
    const context = {
      ...nothingDone,
      hasPlan: true,
      plannedCategories: ["CATERING" as const],
      categoriesWithInquiry: ["CATERING" as const],
    };
    expect(names(context)).toEqual(["plan", "venues"]);
    expect(whyFor("vendors", context)).toBe("every category already has an inquiry");
  });

  it("doesn't draft when the existing plan allocated nothing", () => {
    // Categories exist, so the redraft isn't seeding them, but none carries
    // an allocation — there's nothing to shop against.
    const context = { ...nothingDone, hasPlan: true };
    expect(names(context)).toEqual(["plan", "venues"]);
    expect(whyFor("vendors", context)).toBe("no budget categories yet");
  });

  it("runs on a blank event, because the plan step writes its categories", () => {
    expect(names(nothingDone)).toContain("vendors");
  });
});

describe("skippedSteps", () => {
  it("has exactly one entry per omitted step and none for an included one", () => {
    const context = { ...nothingDone, hasVenue: true, cityIsScoutable: false };
    const ran = planSteps(brief, context).map((step) => step.name);
    const skipped = skippedSteps(brief, context).map((step) => step.name);
    expect(ran).toEqual(["plan"]);
    expect(skipped).toEqual(["venues", "vendors"]);
    // The two lists partition the three steps — no step is both, none is neither.
    expect([...ran, ...skipped].sort()).toEqual(["plan", "vendors", "venues"]);
  });

  it("every skip carries a non-empty sentence", () => {
    const context = { ...nothingDone, cityIsScoutable: false };
    const skipped = skippedSteps({ ...brief, budgetTotalCents: 0 }, context);
    expect(skipped).toHaveLength(3);
    for (const step of skipped) expect(step.why.length).toBeGreaterThan(0);
  });
});
