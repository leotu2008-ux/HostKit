# Wiring the Phase 4 Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect two Phase 4 features that shipped but were never wired to a user-facing path — the model-backed planner, and the campus conflict count that the turnout model already accepts.

**Architecture:** Both tasks follow the same shape the codebase already uses: the decision lives in a **pure, exported function in `lib/`** with unit tests, and the server action or page component becomes a thin caller. Neither task adds a dependency, a migration, or a new UI element — the copy, the panels and the fallbacks all already exist.

**Tech Stack:** TypeScript, Next.js 16 (App Router, server actions), Prisma 7, Vitest, Zod.

**Spec:** No separate spec document exists. This plan is derived from intent already written into the codebase:
- `lib/ai/client.ts:1-28` — the four rules every model caller must honour.
- `app/(app)/events/[id]/guests/page.tsx:68-70` — a TODO that names PR #48 as its unblocking condition. #48 merged in `6fe399e`; the TODO is now stale.
- `lib/turnout.ts:52-54` — `BUSY_NIGHT_PENALTY` / `BUSY_NIGHT_THRESHOLD`, added in anticipation of this wiring.

## Decision taken, flag if wrong

`lib/ai/client.ts:34-37` says "the first caller sits in the event-create flow." **This plan wires the model into the "Redraft the plan" button instead**, because that path is an explicit user action, already has a pending state (`components/plan-forms.tsx:10-18`) that covers a slow answer, and already falls back to the heuristic. Putting it in event creation would add up to 12s of latency to a flow every user must pass through.

If you want the create flow instead, stop and re-plan Task 1 — the mapper (`planDraftInputFor`) is reusable either way, but the caller and its test change.

## Global Constraints

- Node `>=20.19.0` (`package.json` engines).
- **Server actions and page components are not unit tested in this repo.** Every test under `tests/unit/` targets a pure `lib/` module; `tests/unit/conflicts.test.ts` tests only the pure half of a file that also holds queries. Do not introduce a database mock — put new logic in a pure function and test that.
- **The model is never required.** Without `ANTHROPIC_API_KEY` the feature is off and the heuristic is the floor (`lib/ai/client.ts:15-18`). Never delete or bypass `generatePlan`.
- **Never trust model output** — it is parsed against a Zod schema and a failure is treated as the model being down (`lib/ai/client.ts:20-22`).
- No new npm dependencies.
- Never run `prisma migrate dev` against a non-local database; `scripts/guard-local-db.mjs` enforces this. **This plan requires no migration at all.**
- Commit messages: imperative, sentence case, **no** `feat:`/`fix:` prefix — match `git log` (e.g. "Add non-destructive regeneration for plans and run sheets"). End each commit message with:
  `Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa`
- Verification commands: `npm test` (vitest), `npm run lint`, `npm run typecheck`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/ai/plan-draft.ts` | Modify | Gains `planDraftInputFor` — the pure Event-row → model-input mapper. |
| `lib/actions/plan.ts` | Modify (lines 6, 25-29) | Calls `draftPlan` instead of `generatePlan`. Thin. |
| `tests/unit/plan-draft.test.ts` | Modify (append) | Covers the mapper, including that it leaks no extra fields. |
| `lib/campus/conflicts.ts` | Modify (line 209, plus two appends) | Gains pure `loadForNight` (extracted from `adviseNight`) and query `conflictCountFor`. |
| `tests/unit/conflicts.test.ts` | Modify (append) | Covers `loadForNight`. |
| `app/(app)/events/[id]/guests/page.tsx` | Modify (lines 6-7, 58-72) | Passes a real conflict count into `predictTurnout`. |

The two tasks touch disjoint files and can be reviewed independently.

---

### Task 1: Model-backed redraft

Wires the merged-but-unreachable `draftPlan` into the "Redraft the plan" button.

**Files:**
- Modify: `lib/ai/plan-draft.ts` (append after `draftPlan`, ends line 168)
- Modify: `lib/actions/plan.ts:6` and `lib/actions/plan.ts:25-29`
- Test: `tests/unit/plan-draft.test.ts` (append)

**Interfaces:**
- Consumes: `draftPlan(input: PlanInput & { title: string; city: string; guestCount: number }, options?: DraftPlanOptions): Promise<{ plan: GeneratedPlan; source: "model" | "fallback" }>` — already exists at `lib/ai/plan-draft.ts:146`. `PlanInput = { type: EventType; date: Date | null; budgetTotalCents: number }` (`lib/plan.ts:36`).
- Produces: `planDraftInputFor(event): PlanInput & { title: string; city: string; guestCount: number }` — exported from `lib/ai/plan-draft.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/plan-draft.test.ts`. Note `planDraftInputFor` must be added to the existing import from `@/lib/ai/plan-draft` on line 2.

```ts
describe("reading a draft input off an event row", () => {
  // `toEqual` is exact, which is the point: an Event row carries ownerId,
  // schoolDomain and more, and none of it belongs in a model prompt. If
  // someone widens the mapper, this fails.
  it("takes the six fields the model is given, and nothing else", () => {
    const row = {
      id: "evt_1",
      ownerId: "user_1",
      schoolDomain: "babson.edu",
      type: "MIXER" as const,
      date: inDays(21),
      budgetTotalCents: 500_000,
      title: "Fall Mixer",
      city: "Boston",
      guestCount: 60,
    };

    expect(planDraftInputFor(row)).toEqual({
      type: "MIXER",
      date: row.date,
      budgetTotalCents: 500_000,
      title: "Fall Mixer",
      city: "Boston",
      guestCount: 60,
    });
  });

  it("passes a null date through, for an event with no date yet", () => {
    const row = {
      type: "FORMAL" as const,
      date: null,
      budgetTotalCents: 0,
      title: "Spring Formal",
      city: "Boston",
      guestCount: 120,
    };

    expect(planDraftInputFor(row).date).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/plan-draft.test.ts`
Expected: FAIL — `planDraftInputFor is not a function` (or a TypeScript/import error naming it).

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/ai/plan-draft.ts`, after `draftPlan` ends at line 168:

```ts
/**
 * The fields draftPlan is given, read off an Event row.
 *
 * Pure and separate from the action because lib/actions is not unit tested
 * here — and because the model should see the event, not the row: an Event
 * also carries ownerId and schoolDomain, which are nobody's business in a
 * prompt.
 */
export function planDraftInputFor(event: {
  type: EventType;
  date: Date | null;
  budgetTotalCents: number;
  title: string;
  city: string;
  guestCount: number;
}): PlanInput & { title: string; city: string; guestCount: number } {
  return {
    type: event.type,
    date: event.date,
    budgetTotalCents: event.budgetTotalCents,
    title: event.title,
    city: event.city,
    guestCount: event.guestCount,
  };
}
```

`EventType` (line 2) and `PlanInput` (line 14, inside the `@/lib/plan` import block) are already imported at the top of this file — do not add duplicate imports.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/plan-draft.test.ts`
Expected: PASS, all cases including the pre-existing `draftPlan` suites.

- [ ] **Step 5: Point the action at the model**

In `lib/actions/plan.ts`, replace the import on line 6:

```ts
import { draftPlan, planDraftInputFor } from "@/lib/ai/plan-draft";
```

`generatePlan` is used nowhere else in this file, so removing its import is required — an unused import fails `npm run lint`.

Replace lines 25-29:

```ts
  // draftPlan tries the model and falls back to generatePlan on any failure —
  // a missing key, a timeout, an answer that doesn't validate. The heuristic
  // is still the floor; this only ever improves on it.
  const { plan } = await draftPlan(planDraftInputFor(event));
```

Then extend the function's doc comment (lines 9-17) with a line recording the new behaviour:

```
 * The draft comes from the model when one is configured, and from the
 * heuristic template when it is not — draftPlan decides, and the caller
 * cannot tell the difference.
```

- [ ] **Step 6: Verify types and lint**

Run: `npm run typecheck`
Expected: PASS. `draftPlan` returns `GeneratedPlan`, whose `tasks` carry exactly the `title`/`notes`/`offsetDays`/`category`/`dueDate` the `createMany` at `lib/actions/plan.ts:40-52` reads, so no other change is needed.

Run: `npm run lint`
Expected: PASS with no unused-import error for `generatePlan`.

- [ ] **Step 7: Run the full unit suite**

Run: `npm test`
Expected: PASS. Nothing else imports `regeneratePlanAction`, and the existing `replan` and `plan` suites are untouched.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/plan-draft.ts lib/actions/plan.ts tests/unit/plan-draft.test.ts
git commit -m "$(cat <<'EOF'
Draft the redrafted plan with the model, when there is one

draftPlan shipped in #52 with no caller. The redraft button is the right
first home for it: an explicit action, with a pending state that covers a
slow answer and the heuristic underneath it either way.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

### Task 2: Feed the campus conflict count into turnout

`predictTurnout` has taken a `conflicts` count since #49 and the guests page has passed `null` since #49. #48 shipped the data. This connects them.

**Files:**
- Modify: `lib/campus/conflicts.ts:209` (inside `adviseNight`), plus two appends
- Modify: `app/(app)/events/[id]/guests/page.tsx:6-7` and `:58-72`
- Test: `tests/unit/conflicts.test.ts` (append)

**Interfaces:**
- Consumes: `nightLoads(schoolDomain, from: Date, days: number): Promise<NightLoad[]>` (`lib/campus/conflicts.ts:155`), `nightOf(when: Date): Date` (`:90`), `toWallClock(local: Date): Date` (`:69`), `NightLoad = { night: Date; count: number }` (`:44`). `predictTurnout` reads `conflicts?: number | null` (`lib/turnout.ts:141`).
- Produces: `loadForNight(loads: NightLoad[], night: Date): NightLoad` and `conflictCountFor(schoolDomain: string | null | undefined, start: Date | null | undefined): Promise<number | null>`, both exported from `lib/campus/conflicts.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/conflicts.test.ts`. Add `loadForNight` to the existing import block that starts on line 2.

```ts
describe("the load for one night", () => {
  it("finds the night in a run of them", () => {
    const loads = [
      { night: new Date("2026-09-24T00:00:00Z"), count: 14 },
      { night: new Date("2026-09-25T00:00:00Z"), count: 2 },
    ];

    expect(loadForNight(loads, new Date("2026-09-24T00:00:00Z")).count).toBe(14);
  });

  // An empty night is a real answer — "nothing else is on" is exactly what a
  // host wants to hear — so a miss must not read as undefined.
  it("reports an empty night when the run doesn't reach it", () => {
    const night = new Date("2026-10-01T00:00:00Z");

    expect(loadForNight([], night)).toEqual({ night, count: 0 });
  });

  it("matches on the instant, not on object identity", () => {
    const loads = [{ night: new Date("2026-09-24T00:00:00Z"), count: 7 }];

    expect(loadForNight(loads, new Date("2026-09-24T00:00:00Z")).count).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/conflicts.test.ts`
Expected: FAIL — `loadForNight is not a function` (or an import error naming it).

- [ ] **Step 3: Extract the pure lookup**

Add to `lib/campus/conflicts.ts`, immediately after `betterNights` (which ends at line 125) and **before** the `// Queries` banner at lines 127-129, so it sits with the other pure functions:

```ts
/**
 * The load recorded for one night, or an empty night when the run doesn't
 * cover it. Pulled out of adviseNight so a caller that wants only the number
 * asks the same question the panel does, rather than a second, drifting one.
 */
export function loadForNight(loads: NightLoad[], night: Date): NightLoad {
  return loads.find((l) => l.night.getTime() === night.getTime()) ?? { night, count: 0 };
}
```

Then, in `adviseNight`, replace line 209 (its number shifts down by the block you just added):

```ts
  const load = loads.find((l) => l.night.getTime() === night.getTime()) ?? { night, count: 0 };
```

with:

```ts
  const load = loadForNight(loads, night);
```

This is a pure refactor — `adviseNight` behaves identically.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/conflicts.test.ts`
Expected: PASS, including every pre-existing case in the file.

- [ ] **Step 5: Add the count-only query**

Append to the end of `lib/campus/conflicts.ts`:

```ts
/**
 * How many other things are on the evening of `start` — the number alone, for
 * callers that do not need the panel's clashes and alternatives.
 *
 * One night, so one query: lib/turnout.ts reads this as `conflicts` and only
 * cares whether the night crosses BUSY_NIGHT_THRESHOLD. Null when there is no
 * school or no date, which predictTurnout treats as an ordinary night.
 */
export async function conflictCountFor(
  schoolDomain: string | null | undefined,
  start: Date | null | undefined,
): Promise<number | null> {
  if (!schoolDomain || !start) return null;

  // Same crossing of the two time conventions adviseNight makes.
  const when = toWallClock(start);
  const loads = await nightLoads(schoolDomain, when, 1);

  return loadForNight(loads, nightOf(when)).count;
}
```

- [ ] **Step 6: Wire it into the guests page**

In `app/(app)/events/[id]/guests/page.tsx`, add after line 7:

```ts
import { conflictCountFor } from "@/lib/campus/conflicts";
```

Replace lines 56-72 entirely:

```tsx
  // How many of them actually turn up, which is a different question and the
  // one that decides how much food to order. A crowded campus night costs a
  // little of it, so the two queries go together.
  const [history, conflicts] = await Promise.all([
    showHistoryFor({
      ownerId: event.ownerId,
      schoolDomain: event.schoolDomain,
    }),
    conflictCountFor(event.schoolDomain, event.date),
  ]);
  const turnout = predictTurnout({
    attendingHeads: summary.confirmedHeads,
    maybeHeads: summary.maybe,
    noReplyHeads: Math.max(0, summary.expectedHeads - summary.confirmedHeads - summary.maybe),
    capacity: event.guestCount,
    daysUntil: daysUntil(event.date),
    conflicts,
    history,
  });
```

The stale `// The campus conflict count plugs in here once #48 lands` comment must be gone. No copy change is needed for the card: `lib/turnout.ts:187-189` already emits "It is a busy night on campus, which usually costs a little turnout." into `basis` whenever the multiplier bites, and the page already renders `turnout.basis`.

- [ ] **Step 7: Verify types, lint and the full suite**

Run: `npm run typecheck`
Expected: PASS — `conflictCountFor` returns `number | null` and `TurnoutInput.conflicts` is `number | null | undefined` (`lib/turnout.ts:91`).

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS. `tests/unit/turnout.test.ts:118-119` already asserts a busy night lowers the estimate, so the behaviour this unlocks is covered.

- [ ] **Step 8: Commit**

```bash
git add lib/campus/conflicts.ts app/\(app\)/events/\[id\]/guests/page.tsx tests/unit/conflicts.test.ts
git commit -m "$(cat <<'EOF'
Let a busy campus night lower the turnout estimate

#49 took a conflicts count and passed null; #48 shipped the data and the
two were never joined. loadForNight comes out of adviseNight so the number
and the panel answer from one lookup.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

## Final verification

- [ ] **Run the whole gate the way CI does**

```bash
npm run lint
npm run typecheck
npm test
```

All three must pass. CI additionally runs `npx prisma migrate deploy` against a throwaway Postgres and then Playwright (`.github/workflows/ci.yml`); neither task changes the schema or a tested user journey, but if you want the full sweep locally: `npm run test:e2e`.

- [ ] **Push and open the PR**

```bash
git push -u origin wire-phase4-signals
```

PR body should say what it is: two features that merged without callers, now connected, with no new UI and no migration.

## Self-review notes

Checked against the three sources of truth listed under **Spec**:

1. **Coverage** — `lib/ai/client.ts`'s "absence is normal" rule is honoured (Task 1 never removes `generatePlan`; `draftPlan` owns the fallback). The stale TODO at `guests/page.tsx:68-70` is deleted by Task 2 Step 6. `BUSY_NIGHT_PENALTY` gets its first real input.
2. **Placeholders** — none; every code step carries the literal text to write.
3. **Type consistency** — `planDraftInputFor` returns exactly `draftPlan`'s parameter type; `conflictCountFor` returns `number | null`, which `TurnoutInput.conflicts` accepts; `loadForNight` returns `NightLoad`, which is what `adviseNight` assigns to `load` today.

Known gap, deliberately out of scope: the run sheet has no model-backed drafting equivalent (`lib/actions/runsheet.ts` calls the heuristic `redraftRunSheet` only). That is a separate feature, not a loose wire, so it is not planned here.
