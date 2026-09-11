import type { ListingCategory } from "@/generated/prisma/enums";
import { percentOf } from "@/lib/money";

/** The shape budget maths needs, so callers can pass Prisma rows or fixtures. */
export type BudgetItemLike = {
  estimatedCents: number;
  actualCents: number | null;
  paidCents: number;
};

export type BudgetCategoryLike = {
  category: ListingCategory;
  name: string;
  allocatedCents: number;
  items: BudgetItemLike[];
};

export type BudgetRow = {
  category: ListingCategory;
  name: string;
  allocatedCents: number;
  /** What this category is now expected to cost. */
  committedCents: number;
  paidCents: number;
  /** Positive when committed exceeds the allocation. */
  overCents: number;
  percentOfAllocation: number;
  itemCount: number;
};

export type BudgetSummary = {
  rows: BudgetRow[];
  allocatedCents: number;
  committedCents: number;
  paidCents: number;
  /** Allocation not yet committed. Negative once the event is over budget. */
  remainingCents: number;
  outstandingCents: number;
  percentCommitted: number;
  overBudget: boolean;
  /** Categories whose commitments exceed what was set aside for them. */
  overspentCategories: BudgetRow[];
};

/**
 * What an item is expected to cost: the real figure once it is known, the
 * estimate until then. Quoting a vendor should replace the guess, not add
 * to it.
 */
export function itemCommitment(item: BudgetItemLike): number {
  return item.actualCents ?? item.estimatedCents;
}

export function summarizeBudget(
  categories: BudgetCategoryLike[],
): BudgetSummary {
  const rows: BudgetRow[] = categories.map((c) => {
    const committedCents = c.items.reduce(
      (sum, item) => sum + itemCommitment(item),
      0,
    );
    const paidCents = c.items.reduce((sum, item) => sum + item.paidCents, 0);
    return {
      category: c.category,
      name: c.name,
      allocatedCents: c.allocatedCents,
      committedCents,
      paidCents,
      overCents: Math.max(0, committedCents - c.allocatedCents),
      percentOfAllocation: percentOf(committedCents, c.allocatedCents),
      itemCount: c.items.length,
    };
  });

  const allocatedCents = rows.reduce((s, r) => s + r.allocatedCents, 0);
  const committedCents = rows.reduce((s, r) => s + r.committedCents, 0);
  const paidCents = rows.reduce((s, r) => s + r.paidCents, 0);

  return {
    rows,
    allocatedCents,
    committedCents,
    paidCents,
    remainingCents: allocatedCents - committedCents,
    outstandingCents: Math.max(0, committedCents - paidCents),
    percentCommitted: percentOf(committedCents, allocatedCents),
    overBudget: committedCents > allocatedCents,
    overspentCategories: rows.filter((r) => r.overCents > 0),
  };
}
