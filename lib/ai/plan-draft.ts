import { z } from "zod";
import type { EventType, ListingCategory } from "@/generated/prisma/enums";
import { ListingCategory as ListingCategoryEnum } from "@/generated/prisma/enums";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { EVENT_TEMPLATES, templateFor } from "@/lib/templates";
import { allocateCents } from "@/lib/money";
import { askOr } from "@/lib/ai/client";
import {
  generatePlan,
  resolveHorizonDays,
  sortPlannedTasks,
  taskTiming,
  type GeneratedPlan,
  type PlanInput,
  type PlannedCategory,
  type PlannedTask,
} from "@/lib/plan";

/**
 * A model-backed alternative to generatePlan, behind the same GeneratedPlan
 * contract. The heuristic template is the floor: draftPlan tries the model
 * and falls back to generatePlan on any failure, so a caller can swap one for
 * the other without touching anything downstream.
 */

// Read straight off the schema rather than writing the list out, so a
// category (or event type) added to the schema shows up here automatically
// instead of the model silently never hearing about it.
const CATEGORY_VALUES = Object.values(ListingCategoryEnum) as [
  ListingCategory,
  ...ListingCategory[],
];
const categorySchema = z.enum(CATEGORY_VALUES);

// Lengths, not just presence: applyDraftedPlan writes these straight into
// Task rows, so a model that rambles reaches the database and the host's
// plan list. Sized to what a task line and its note can actually be.
const draftTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
  category: categorySchema.optional(),
  /** 1 = start of planning, 0 = the event itself, matching TaskTemplate. */
  at: z.number().min(0).max(1),
});

const draftBudgetSchema = z.object({
  category: categorySchema,
  /** A relative share, not a dollar amount — the caller does the arithmetic. */
  weight: z.number().positive(),
});

const draftSchema = z
  .object({
    tasks: z.array(draftTaskSchema).min(3).max(25),
    budget: z.array(draftBudgetSchema).min(1),
  })
  // BudgetCategory is @@unique([eventId, category]) in the schema — a model
  // returning the same category twice would throw and roll back event
  // creation. Treated the same as any other malformed answer, so it falls
  // back to the heuristic instead of reaching the database at all.
  .refine((draft) => new Set(draft.budget.map((b) => b.category)).size === draft.budget.length, {
    message: "budget categories must be distinct",
    path: ["budget"],
  });

type DraftAnswer = z.infer<typeof draftSchema>;

const KNOWN_EVENT_TYPES = Object.keys(EVENT_TEMPLATES) as EventType[];

function systemPrompt(): string {
  return [
    "You draft a first-pass event plan for HostKit, a platform students use to plan campus events.",
    `Event types HostKit already knows: ${KNOWN_EVENT_TYPES.join(", ")}.`,
    "Return JSON only, matching the schema you are given. Propose a task list and a set of budget category weights — plain relative numbers, not dollar amounts. The caller converts your weights into an exact dollar split, so they do not need to sum to 1.",
    `Choose "category" only from: ${CATEGORY_VALUES.join(", ")}. Leave it out for a task that isn't tied to one category.`,
    "Never invent a budget figure, a date, a guest count or a vendor name — those are given to you as facts. Each task's \"at\" is its position in the planning runway: 1 is the day planning starts, 0 is the day of the event.",
  ].join("\n");
}

function userPrompt(input: DraftPlanInput, horizonDays: number): string {
  const budgetDollars = Math.round(input.budgetTotalCents / 100);
  const kind = input.kind?.trim();
  return [
    `Event type: ${input.type}`,
    `Title: ${input.title}`,
    // eventTypeForKind falls back to MIXER for anything its keyword table
    // doesn't recognise (lib/brief.ts), so for a silent disco or a crawfish
    // boil the type says almost nothing. Without this line the host's own
    // words for their event never reach the model at all.
    ...(kind ? [`Host's own words for this event: ${kind}`] : []),
    `City: ${input.city}`,
    `Guest count: ${input.guestCount}`,
    `Total budget: $${budgetDollars}`,
    `Planning runway: ${horizonDays} days`,
  ].join("\n");
}

/** Never used: when askOr falls back, draftPlan discards this value and
 *  calls generatePlan directly instead of routing a manufactured answer back
 *  through the model's own conversion path. It exists only to satisfy the
 *  type askOr's fallback callback is required to return. */
function unusedFallback(): DraftAnswer {
  return { tasks: [], budget: [] };
}

/** Turns a validated model answer into a GeneratedPlan. All money arithmetic
 *  happens here, in code, via allocateCents — the model's weights only decide
 *  the split, never the total, so the categories always sum to exactly
 *  budgetTotalCents regardless of what (or how little) the model returns. */
function planFromDraft(
  draft: DraftAnswer,
  input: PlanInput,
  horizonDays: number,
): GeneratedPlan {
  const weights = draft.budget.map((b) => b.weight);
  const amounts = allocateCents(input.budgetTotalCents, weights);
  const categories: PlannedCategory[] = draft.budget.map((b, i) => ({
    category: b.category,
    name: CATEGORY_LABEL[b.category],
    allocatedCents: amounts[i],
  }));

  const tasks: PlannedTask[] = sortPlannedTasks(
    draft.tasks.map((t) => {
      const { offsetDays, dueDate } = taskTiming(t.at, horizonDays, input.date);
      return {
        title: t.title,
        notes: t.notes,
        category: t.category,
        offsetDays,
        dueDate,
      };
    }),
  );

  return {
    categories,
    tasks,
    // "Required" is a fact about the event type, not something for the model
    // to weigh in on — take it from the same template generatePlan uses.
    required: templateFor(input.type).required,
    horizonDays,
  };
}

export type DraftPlanInput = PlanInput & {
  title: string;
  city: string;
  guestCount: number;
  /** The host's free-text kind, if they typed one. */
  kind?: string | null;
};

export type DraftPlanOptions = {
  now?: Date;
  /** Injectable for tests; forwarded to askOr, defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export async function draftPlan(
  input: DraftPlanInput,
  options: DraftPlanOptions = {},
): Promise<{ plan: GeneratedPlan; source: "model" | "fallback" }> {
  const now = options.now ?? new Date();
  const horizonDays = resolveHorizonDays(input, now);

  const { value, source } = await askOr(
    {
      system: systemPrompt(),
      prompt: userPrompt(input, horizonDays),
      schema: draftSchema,
      fetchImpl: options.fetchImpl,
    },
    unusedFallback,
  );

  if (source === "fallback") {
    return { plan: generatePlan(input, now), source: "fallback" };
  }

  return { plan: planFromDraft(value, input, horizonDays), source: "model" };
}
