import type { RowSource, TaskStatus } from "@/generated/prisma/enums";

/**
 * Splits a set of existing rows into what a regenerate may delete and what it
 * must leave standing.
 *
 * A regenerate replaces what the app wrote; it never touches what a person
 * wrote, and never undoes work already done. So a row is only ever
 * replaceable when it is both machine-authored and, for a Task, still open —
 * a ticked-off task is a record of work done, not a draft.
 */
export function tasksToReplace<
  T extends { id: string; source: RowSource; status: TaskStatus },
>(existing: T[]): { remove: string[]; keep: T[] } {
  const remove: string[] = [];
  const keep: T[] = [];
  for (const row of existing) {
    if (row.source === "GENERATED" && row.status === "TODO") {
      remove.push(row.id);
    } else {
      keep.push(row);
    }
  }
  return { remove, keep };
}

/**
 * Same rule for the run sheet, which has no status to protect — only
 * authorship. A HUMAN row survives; a GENERATED row is fair game.
 */
export function runSheetRowsToReplace<T extends { id: string; source: RowSource }>(
  existing: T[],
): { remove: string[]; keep: T[] } {
  const remove: string[] = [];
  const keep: T[] = [];
  for (const row of existing) {
    if (row.source === "GENERATED") {
      remove.push(row.id);
    } else {
      keep.push(row);
    }
  }
  return { remove, keep };
}
