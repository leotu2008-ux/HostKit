import { describe, expect, it } from "vitest";
import { sweepPlan, type SweepCandidate, type SweepEvent } from "@/lib/agent/sweep-plan";

/** A scanned event whose brief as it stands now has no AgentRun row at all —
 *  nothing has planned this brief, whatever its older rows say. */
const unplanned = (id: string): SweepEvent => ({ id, currentBriefHasRun: false });

/** A scanned event whose current brief already has a row: worked, running,
 *  or queued for it. */
const planned = (id: string): SweepEvent => ({ id, currentBriefHasRun: true });

/** An unfinished run whose brief hasn't moved since it was claimed — the row
 *  runAgent will re-claim, so it's also the event's current-brief row. */
const live = (id: string, eventId: string, hash = "aaaa"): SweepCandidate => ({
  id,
  eventId,
  briefHash: hash,
  currentBriefHash: hash,
  currentBriefHasRun: true,
});

/**
 * An unfinished run for a brief that has since changed — runAgent derives the
 * hash from the event, so it can never come back to this row.
 * `currentBriefHasRun` is what separates the two ways that happens: the brief
 * moved on and was worked (the ordinary redraft), or it moved on and the
 * follow-up run was lost.
 */
const zombie = (
  id: string,
  eventId: string,
  currentBriefHasRun: boolean,
): SweepCandidate => ({
  id,
  eventId,
  briefHash: "old",
  currentBriefHash: "new",
  currentBriefHasRun,
});

describe("sweepPlan — runnable rows", () => {
  it("runs the event of a row whose brief hasn't changed", () => {
    expect(sweepPlan([live("r1", "e1")], [], 5)).toEqual({ run: ["e1"], retire: [] });
  });

  it("keeps the order it was given, so the oldest go first", () => {
    const plan = sweepPlan([live("r1", "e1"), live("r2", "e2"), live("r3", "e3")], [], 5);
    expect(plan.run).toEqual(["e1", "e2", "e3"]);
  });

  it("runs an event only once when two of its runs are both unfinished", () => {
    const plan = sweepPlan([live("r1", "e1", "aaaa"), live("r2", "e1", "aaaa")], [], 5);
    expect(plan.run).toEqual(["e1"]);
  });
});

describe("sweepPlan — retiring rows runAgent can never reach", () => {
  it("retires a row whose brief changed and was already worked, without re-running it", () => {
    // The ordinary case: the host edited the brief, the new run happened, and
    // this row is just the old attempt's corpse. Re-running would redo
    // finished work and re-post its feed lines every single day.
    expect(sweepPlan([zombie("r1", "e1", true)], [], 5)).toEqual({ run: [], retire: ["r1"] });
  });

  it("retires the row and runs the event when the new brief was never worked", () => {
    // The gap this closes: the brief changed and the follow-up run was lost
    // (a dropped after(), an event written through the iOS API). Retiring
    // alone would leave that event unplanned forever.
    expect(sweepPlan([zombie("r1", "e1", false)], [], 5)).toEqual({
      run: ["e1"],
      retire: ["r1"],
    });
  });

  it("never lets already-worked zombies use up the run slots", () => {
    // The whole starvation bug: five unreachable rows sorted oldest-first
    // would otherwise fill every slot on every sweep, forever.
    const candidates = [
      zombie("z1", "e1", true),
      zombie("z2", "e2", true),
      zombie("z3", "e3", true),
      zombie("z4", "e4", true),
      zombie("z5", "e5", true),
      live("r6", "e6"),
    ];
    const plan = sweepPlan(candidates, [], 5);
    expect(plan.retire).toEqual(["z1", "z2", "z3", "z4", "z5"]);
    expect(plan.run).toEqual(["e6"]);
  });

  it("retires the stale row and still runs the event's current one", () => {
    const plan = sweepPlan([zombie("z1", "e1", true), live("r2", "e1", "new")], [], 5);
    expect(plan.retire).toEqual(["z1"]);
    expect(plan.run).toEqual(["e1"]);
  });

  it("retires everything it was handed, regardless of the run limit", () => {
    // Retiring is one cheap status write; leaving any behind would re-starve
    // the next sweep.
    const candidates = [
      zombie("z1", "e1", true),
      zombie("z2", "e2", true),
      zombie("z3", "e3", true),
    ];
    expect(sweepPlan(candidates, [], 1).retire).toHaveLength(3);
  });
});

describe("sweepPlan — scanned events with a complete brief", () => {
  it("adds them after the unfinished rows", () => {
    const plan = sweepPlan([live("r1", "e1")], [unplanned("e2"), unplanned("e3")], 5);
    expect(plan.run).toEqual(["e1", "e2", "e3"]);
  });

  it("doesn't run an event twice when it appears in both lists", () => {
    expect(sweepPlan([live("r1", "e1")], [unplanned("e1")], 5).run).toEqual(["e1"]);
  });

  it("is the only source of work when there are no unfinished rows", () => {
    expect(sweepPlan([], [unplanned("e1"), unplanned("e2")], 5)).toEqual({
      run: ["e1", "e2"],
      retire: [],
    });
  });

  it("runs an event whose last run is DONE, whose brief then changed, and whose after() was lost", () => {
    // The gap the broad scan closes. The DONE row is finished, so it's not in
    // `candidates` at all — the sweep's unfinished-row selector can't see it,
    // and neither can a "no runs at all" clause. The only thing that says
    // anything is wrong is that the brief the event carries *now* has no row.
    expect(sweepPlan([], [unplanned("e1")], 5).run).toEqual(["e1"]);
  });

  it("leaves alone an event whose brief hasn't changed since its last run", () => {
    // The whole point of the hash: a DONE row for this exact brief means the
    // agent has read it. Re-running would redraft the same plan and re-post
    // its feed lines on every single sweep.
    expect(sweepPlan([], [planned("e1")], 5)).toEqual({ run: [], retire: [] });
  });

  it("doesn't run an event twice when its current brief is already QUEUED", () => {
    // A rate-limited run parks at QUEUED, which is both an unfinished row
    // (so, a candidate) and a row for the current hash (so, `planned`). It
    // gets exactly one run out of the sweep, not one per list.
    const plan = sweepPlan([live("r1", "e1")], [planned("e1")], 5);
    expect(plan.run).toEqual(["e1"]);
  });
});

describe("sweepPlan — the limit", () => {
  it("caps the events it runs", () => {
    const plan = sweepPlan(
      [],
      ["e1", "e2", "e3", "e4", "e5", "e6", "e7"].map(unplanned),
      5,
    );
    expect(plan.run).toEqual(["e1", "e2", "e3", "e4", "e5"]);
  });

  it("returns nothing to do for an empty sweep", () => {
    expect(sweepPlan([], [], 5)).toEqual({ run: [], retire: [] });
  });
});
