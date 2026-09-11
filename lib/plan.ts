import type { EventType, ListingCategory } from "@/generated/prisma/enums";
import { allocateCents } from "@/lib/money";
import { CATEGORY_LABEL, CATEGORY_LABEL_INLINE } from "@/lib/catalog";
import {
  bookingPosition,
  SPINE_TASKS,
  templateFor,
  type TaskTemplate,
} from "@/lib/templates";

export const DAY_MS = 86_400_000;

export type PlannedCategory = {
  category: ListingCategory;
  name: string;
  allocatedCents: number;
};

export type PlannedTask = {
  title: string;
  notes?: string;
  offsetDays: number;
  category?: ListingCategory;
  dueDate: Date | null;
};

export type GeneratedPlan = {
  categories: PlannedCategory[];
  tasks: PlannedTask[];
  /** Categories this event is not covered without. */
  required: ListingCategory[];
  /** Days of runway actually available, or null if no date is set yet. */
  horizonDays: number;
};

export type PlanInput = {
  type: EventType;
  date: Date | null;
  budgetTotalCents: number;
};

/** Midnight local time, so "days until" never depends on the time of day. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from `from` to `to`. Negative if `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

/**
 * Turns the intake answers into a budget, a timeline and a list of what the
 * event still needs.
 *
 * Pure — no database, no clock of its own — so the interesting cases (a
 * fundraiser booked six weeks out, a budget that doesn't divide evenly, an event
 * with no date yet) are all reachable from tests.
 */
export function generatePlan(input: PlanInput, now = new Date()): GeneratedPlan {
  const template = templateFor(input.type);

  // Budget. allocateCents guarantees the parts sum to exactly the total, so a
  // 100-guest fundraiser's categories always add back up to what the host typed.
  const weights = template.budget.map((b) => b.weight);
  const amounts = allocateCents(input.budgetTotalCents, weights);
  const categories: PlannedCategory[] = template.budget.map((b, i) => ({
    category: b.category,
    name: CATEGORY_LABEL[b.category],
    allocatedCents: amounts[i],
  }));

  // Timeline. If the event is sooner than the template's comfortable runway,
  // compress the whole plan into the time that actually exists rather than
  // emitting tasks that were due before the host signed up.
  const leadDays = input.date ? daysBetween(now, input.date) : null;
  const horizonDays =
    leadDays === null
      ? template.horizonDays
      : Math.max(0, Math.min(template.horizonDays, leadDays));

  const bookingTasks: TaskTemplate[] = template.required.map((category) => ({
    title:
      category === "VENUE"
        ? "Book the venue"
        : `Book the ${CATEGORY_LABEL_INLINE[category]}`,
    at: bookingPosition(category),
    category,
  }));

  const tasks = [...SPINE_TASKS, ...bookingTasks, ...template.extraTasks]
    .map((t) => {
      const offsetDays = Math.round(t.at * horizonDays);
      return {
        title: t.title,
        notes: t.notes,
        category: t.category,
        offsetDays,
        dueDate: input.date
          ? startOfDay(new Date(input.date.getTime() - offsetDays * DAY_MS))
          : null,
      };
    })
    // Soonest first. Ties break on title so the order is stable across runs
    // and a test can assert on it.
    .sort((a, b) =>
      b.offsetDays !== a.offsetDays
        ? b.offsetDays - a.offsetDays
        : a.title.localeCompare(b.title),
    );

  return {
    categories,
    tasks,
    required: template.required,
    horizonDays,
  };
}

/** Days until the event, or null when no date is set. Negative once past. */
export function daysUntil(date: Date | null, now = new Date()): number | null {
  return date ? daysBetween(now, date) : null;
}

/** "in 3 months", "in 12 days", "tomorrow", "today", "2 days ago". */
export function describeCountdown(days: number | null): string {
  if (days === null) return "No date set";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) {
    const past = Math.abs(days);
    return past === 1 ? "Yesterday" : `${past} days ago`;
  }
  if (days < 45) return `in ${days} days`;
  const months = Math.round(days / 30);
  if (months < 18) return `in ${months} months`;
  return `in ${Math.round(days / 365)} years`;
}
