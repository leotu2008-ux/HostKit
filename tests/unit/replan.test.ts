import { describe, expect, it } from "vitest";
import {
  dedupeGeneratedTasks,
  removableRunSheetRowWhere,
  removableTaskWhere,
  runSheetRowsToReplace,
  tasksToReplace,
} from "@/lib/replan";

type FakeTask = { id: string; source: "GENERATED" | "HUMAN"; status: "TODO" | "DONE" };
type FakeRow = { id: string; source: "GENERATED" | "HUMAN" };

describe("tasksToReplace", () => {
  it("removes a GENERATED task that is still TODO", () => {
    const task: FakeTask = { id: "t1", source: "GENERATED", status: "TODO" };
    const { remove, keep } = tasksToReplace([task]);
    expect(remove).toEqual(["t1"]);
    expect(keep).toEqual([]);
  });

  it("keeps a GENERATED task that is already DONE", () => {
    // A ticked-off task is a record of work done, not a draft — a regenerate
    // must never undo that, even though the app wrote the row.
    const task: FakeTask = { id: "t2", source: "GENERATED", status: "DONE" };
    const { remove, keep } = tasksToReplace([task]);
    expect(remove).toEqual([]);
    expect(keep).toEqual([task]);
  });

  it("keeps a HUMAN task whatever its status", () => {
    const todo: FakeTask = { id: "h1", source: "HUMAN", status: "TODO" };
    const done: FakeTask = { id: "h2", source: "HUMAN", status: "DONE" };
    const { remove, keep } = tasksToReplace([todo, done]);
    expect(remove).toEqual([]);
    expect(keep).toEqual([todo, done]);
  });

  it("partitions a mixed list so every row appears exactly once, in remove xor keep", () => {
    const tasks: FakeTask[] = [
      { id: "1", source: "GENERATED", status: "TODO" },
      { id: "2", source: "GENERATED", status: "DONE" },
      { id: "3", source: "HUMAN", status: "TODO" },
      { id: "4", source: "HUMAN", status: "DONE" },
      { id: "5", source: "GENERATED", status: "TODO" },
    ];
    const { remove, keep } = tasksToReplace(tasks);

    // Independently derived expectation — not read off `remove`/`keep` — so a
    // bug that flips the predicate or drops a row actually fails this test.
    const expectedRemoveIds = new Set(
      tasks
        .filter((t) => t.source === "GENERATED" && t.status === "TODO")
        .map((t) => t.id),
    );

    const removeIds = new Set(remove);
    const keepIds = new Set(keep.map((t) => t.id));

    expect(removeIds).toEqual(expectedRemoveIds);
    // Disjoint: nothing removed is also kept.
    for (const id of removeIds) expect(keepIds.has(id)).toBe(false);
    // Complete: every input id lands in exactly one of the two sets.
    for (const t of tasks) {
      expect(removeIds.has(t.id) !== keepIds.has(t.id)).toBe(true);
    }
    expect(removeIds.size + keepIds.size).toBe(tasks.length);
  });

  it("produces empty sets for an empty list rather than throwing", () => {
    const { remove, keep } = tasksToReplace([]);
    expect(remove).toEqual([]);
    expect(keep).toEqual([]);
  });
});

describe("runSheetRowsToReplace", () => {
  it("removes a GENERATED row", () => {
    const row: FakeRow = { id: "r1", source: "GENERATED" };
    const { remove, keep } = runSheetRowsToReplace([row]);
    expect(remove).toEqual(["r1"]);
    expect(keep).toEqual([]);
  });

  it("keeps a HUMAN row", () => {
    const row: FakeRow = { id: "r2", source: "HUMAN" };
    const { remove, keep } = runSheetRowsToReplace([row]);
    expect(remove).toEqual([]);
    expect(keep).toEqual([row]);
  });

  it("partitions a mixed list completely and disjointly", () => {
    const rows: FakeRow[] = [
      { id: "a", source: "GENERATED" },
      { id: "b", source: "HUMAN" },
      { id: "c", source: "GENERATED" },
      { id: "d", source: "HUMAN" },
    ];
    const { remove, keep } = runSheetRowsToReplace(rows);

    const expectedRemoveIds = new Set(
      rows.filter((r) => r.source === "GENERATED").map((r) => r.id),
    );
    const removeIds = new Set(remove);
    const keepIds = new Set(keep.map((r) => r.id));

    expect(removeIds).toEqual(expectedRemoveIds);
    for (const id of removeIds) expect(keepIds.has(id)).toBe(false);
    for (const r of rows) {
      expect(removeIds.has(r.id) !== keepIds.has(r.id)).toBe(true);
    }
    expect(removeIds.size + keepIds.size).toBe(rows.length);
  });

  it("produces empty sets for an empty list rather than throwing", () => {
    const { remove, keep } = runSheetRowsToReplace([]);
    expect(remove).toEqual([]);
    expect(keep).toEqual([]);
  });
});

/**
 * `removableTaskWhere`/`removableRunSheetRowWhere` back the delete-time guard
 * against a snapshot going stale: `remove` is a list of ids read before the
 * transaction started, and a plain non-transactional write elsewhere (e.g.
 * `toggleTaskAction`) can change a row's `status` in the gap before the
 * delete runs. The fix is that the delete's own `where` re-asserts
 * `source`/`status` instead of trusting the id list alone.
 *
 * This project has no seam for exercising a live Prisma `deleteMany` against
 * a real race (no action-level DB tests exist anywhere in tests/unit/), so
 * the strongest test reachable here is two-part: assert the `where` object
 * actually carries the re-check fields (not just the id filter), then
 * reimplement Prisma's `where`-match semantics by hand against a row whose
 * state changed after the snapshot, and show that row would not match.
 */
describe("removableTaskWhere", () => {
  function matches(where: ReturnType<typeof removableTaskWhere>, row: { id: string; source: string; status: string }) {
    return (
      where.id.in.includes(row.id) &&
      row.source === where.source &&
      row.status === where.status
    );
  }

  it("carries the source and status re-check alongside the id filter", () => {
    const where = removableTaskWhere(["t1"]);
    expect(where).toEqual({ id: { in: ["t1"] }, source: "GENERATED", status: "TODO" });
  });

  it("would still match a row unchanged since the snapshot", () => {
    const where = removableTaskWhere(["t1"]);
    expect(matches(where, { id: "t1", source: "GENERATED", status: "TODO" })).toBe(true);
  });

  it("would not match a row ticked DONE after the snapshot was taken", () => {
    // t1 was TODO when `remove` was built (that's why its id is in the list)
    // but a host ticked it off before the delete ran.
    const where = removableTaskWhere(["t1"]);
    const rowNow = { id: "t1", source: "GENERATED", status: "DONE" };
    expect(matches(where, rowNow)).toBe(false);
  });
});

describe("removableRunSheetRowWhere", () => {
  it("carries the source re-check alongside the id filter", () => {
    const where = removableRunSheetRowWhere(["r1"]);
    expect(where).toEqual({ id: { in: ["r1"] }, source: "GENERATED" });
  });
});

/**
 * `dedupeGeneratedTasks` is the fix for the redraft-resurrects-work bug: a
 * freshly generated task must not sit down beside a kept task that already
 * represents the same piece of work, or a host's completed "Book the
 * caterer" comes back as a brand new TODO.
 */
describe("dedupeGeneratedTasks", () => {
  it("drops a generated task whose title exactly matches a kept task", () => {
    const generated = [{ title: "Book the caterer", category: "CATERING" as const }];
    const kept = [{ title: "Book the caterer", category: "CATERING" as const }];
    expect(dedupeGeneratedTasks(generated, kept)).toEqual([]);
  });

  it("matches case-insensitively and across whitespace differences", () => {
    const generated = [{ title: "  BOOK   the Caterer" }];
    const kept = [{ title: "Book the caterer" }];
    expect(dedupeGeneratedTasks(generated, kept)).toEqual([]);
  });

  it("keeps a generated task with the same title but a different category on both sides", () => {
    // Two "Book the venue"-shaped tasks for different categories are
    // genuinely different tasks, not duplicates.
    const generated = [{ title: "Book the venue", category: "VENUE" as const }];
    const kept = [{ title: "Book the venue", category: "CATERING" as const }];
    expect(dedupeGeneratedTasks(generated, kept)).toEqual(generated);
  });

  it("matches on title alone when only one side has a category", () => {
    const generated = [{ title: "Draft the guest list", category: "VENUE" as const }];
    const kept = [{ title: "Draft the guest list" }];
    expect(dedupeGeneratedTasks(generated, kept)).toEqual([]);
  });

  it("keeps every generated task with no title match in kept", () => {
    const generated = [{ title: "Order the cake" }, { title: "Confirm final headcount" }];
    const kept = [{ title: "Book the venue" }];
    expect(dedupeGeneratedTasks(generated, kept)).toEqual(generated);
  });

  it("is independent per generated task, not all-or-nothing", () => {
    const generated = [
      { title: "Book the caterer", category: "CATERING" as const },
      { title: "Order the cake", category: "CAKE_DESSERT" as const },
    ];
    const kept = [{ title: "Book the caterer", category: "CATERING" as const }];

    const result = dedupeGeneratedTasks(generated, kept);

    expect(result).toEqual([{ title: "Order the cake", category: "CAKE_DESSERT" as const }]);
  });
});
