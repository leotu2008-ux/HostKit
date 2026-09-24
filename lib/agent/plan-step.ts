import type { EventType } from "@/generated/prisma/enums";
import type { ActivityLine } from "@/lib/activity";
import { draftPlan } from "@/lib/ai/plan-draft";
import { regenerateTasksAndCategories } from "@/lib/replan-apply";

/**
 * The agent's plan step: a budget split and a timeline for this event.
 *
 * The model only decides the shape of the plan — the split weights and the
 * task list — and everything it returns is schema-checked before it's used,
 * with the heuristic template underneath when it isn't there at all (the four
 * rules in lib/ai/client.ts). The writing itself goes through the same helper
 * the host's own "redraft the plan" button uses, so there is exactly one
 * definition of what a redraft may touch and a second run is safe.
 */

export type PlanStepEvent = {
  id: string;
  title: string;
  kind: string | null;
  type: EventType;
  date: Date | null;
  city: string;
  guestCount: number;
  budgetTotalCents: number;
};

/** Kept back from the run's deadline for the writes after the model answers,
 *  so a slow model falls back to the template instead of outlasting the run. */
const PLAN_WRITE_MARGIN_MS = 3_000;

export async function applyDraftedPlan(
  event: PlanStepEvent,
  options: { deadline: number; fetchImpl?: typeof fetch },
): Promise<ActivityLine> {
  const input = {
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
  };

  const { plan, source } = await draftPlan(
    {
      ...input,
      title: event.title,
      city: event.city,
      guestCount: event.guestCount,
      kind: event.kind,
    },
    { budgetMs: options.deadline - Date.now() - PLAN_WRITE_MARGIN_MS, fetchImpl: options.fetchImpl },
  );

  const { tasks, categories } = await regenerateTasksAndCategories(event.id, input, {
    plan,
    refreshGeneratedCategories: true,
  });

  return {
    actor: "agent",
    kind: "plan_drafted",
    title: "Plan drafted",
    body: `${tasks} tasks · ${categories} budget categories · ${
      source === "model" ? "written for this event" : "from the template"
    }`,
    href: `/events/${event.id}/plan`,
  };
}
