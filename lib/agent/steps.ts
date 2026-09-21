import type { ListingCategory } from "@/generated/prisma/enums";
import type { BriefFacts } from "@/lib/brief";

/**
 * Which of the agent's three steps are worth running for one event, and the
 * sentence the host reads for each one that isn't.
 *
 * Pure on purpose, and deliberately separate from briefIsComplete: that only
 * decides whether a run starts by *itself*. This decides what's runnable,
 * which is what makes the manual "run the agent" button useful on a
 * half-filled brief — a host who's given a budget but no headcount still gets
 * a plan. Every omitted step carries its own reason, so "nothing happened" is
 * never what the feed says.
 */

export type StepName = "plan" | "venues" | "vendors";

export type StepContext = {
  /** Any BudgetCategory rows for this event. */
  hasPlan: boolean;
  /** A VENUE collaborator, or a BOOKED VENUE-category inquiry. */
  hasVenue: boolean;
  /** lib/venues/search.ts's isVenueSearchConfigured(). */
  venueSearchConfigured: boolean;
  /** isCity(event.city) — HostKit only geocodes the cities it lists. */
  cityIsScoutable: boolean;
  /** Categories with a budget allocation above zero. */
  plannedCategories: ListingCategory[];
  /** Categories that already have an Inquiry row. */
  categoriesWithInquiry: ListingCategory[];
};

export type Step = { name: StepName; reason: string };
export type SkippedStep = { name: StepName; why: string };

/** One step's verdict. Keeping "run it, because" and "don't, because" in the
 *  same value is what guarantees planSteps and skippedSteps partition the
 *  three steps rather than drifting apart as the rules change. */
type Verdict =
  | { name: StepName; run: true; reason: string }
  | { name: StepName; run: false; why: string };

/** The categories the vendor step shops for: what the plan allocated money
 *  to, minus the venue (the venue step's job) and minus anything already
 *  under inquiry. Order is the plan's own. */
export function vendorCategories(context: StepContext): ListingCategory[] {
  const claimed = new Set(context.categoriesWithInquiry);
  return context.plannedCategories.filter(
    (category) => category !== "VENUE" && !claimed.has(category),
  );
}

function planVerdict(brief: BriefFacts, context: StepContext): Verdict {
  if (!(brief.budgetTotalCents > 0)) {
    return { name: "plan", run: false, why: "there's no budget to split yet" };
  }
  return {
    name: "plan",
    run: true,
    reason: context.hasPlan ? "the brief changed" : "no plan yet",
  };
}

function venuesVerdict(brief: BriefFacts, context: StepContext): Verdict {
  // First reason that applies, strongest first: a host who already has a
  // venue isn't waiting on a search, whatever else is switched off.
  const why = context.hasVenue
    ? "you already have a venue"
    : !context.venueSearchConfigured
      ? "venue search isn't switched on here"
      : !context.cityIsScoutable
        ? "HostKit doesn't scout that city yet"
        : brief.guestCount < 1
          ? "add a headcount first"
          : null;
  if (why) return { name: "venues", run: false, why };
  return { name: "venues", run: true, reason: "no venue yet" };
}

function vendorsVerdict(context: StepContext, planWillSeedCategories: boolean): Verdict {
  if (!context.cityIsScoutable) {
    return { name: "vendors", run: false, why: "HostKit doesn't scout that city yet" };
  }
  // A first plan writes the very categories this step shops for, so a run
  // about to draft one counts as having them: on a blank event the context
  // was read before any existed. runAgent re-reads the categories after the
  // plan step, so this step sees what was just written. Once a plan exists
  // the context is authoritative again — a redraft that turns up nothing new
  // should say so here, not run and find nothing.
  if (vendorCategories(context).length === 0 && !planWillSeedCategories) {
    return {
      name: "vendors",
      run: false,
      why:
        context.plannedCategories.length === 0
          ? "no budget categories yet"
          : "every category already has an inquiry",
    };
  }
  return { name: "vendors", run: true, reason: "categories still without an inquiry" };
}

/** Always in the fixed order plan → venues → vendors. */
function verdicts(brief: BriefFacts, context: StepContext): Verdict[] {
  const plan = planVerdict(brief, context);
  return [
    plan,
    venuesVerdict(brief, context),
    vendorsVerdict(context, plan.run && !context.hasPlan),
  ];
}

export function planSteps(brief: BriefFacts, context: StepContext): Step[] {
  const steps: Step[] = [];
  for (const verdict of verdicts(brief, context)) {
    if (verdict.run) steps.push({ name: verdict.name, reason: verdict.reason });
  }
  return steps;
}

export function skippedSteps(brief: BriefFacts, context: StepContext): SkippedStep[] {
  const skipped: SkippedStep[] = [];
  for (const verdict of verdicts(brief, context)) {
    if (!verdict.run) skipped.push({ name: verdict.name, why: verdict.why });
  }
  return skipped;
}
