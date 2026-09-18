import { describe, expect, it } from "vitest";
import { runSheetRowsToReplace, tasksToReplace } from "@/lib/replan";

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
