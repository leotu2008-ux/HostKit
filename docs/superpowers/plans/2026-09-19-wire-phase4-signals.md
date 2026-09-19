# Host-Side Planning Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the host the three things they need at the moment they need them — say what kind of night this is, learn the night is crowded *before* committing to it, and see a turnout estimate that accounts for the competition.

**Architecture:** Every task follows the shape the repo already uses: the rule lives in a **pure, exported function in `lib/`** with unit tests, and the page, form or action is a thin caller. Two of the three tasks are front-end gaps over logic that already exists and is already tested — no migration, no new dependency, no new model call.

**Tech Stack:** TypeScript, Next.js 16 (App Router, server actions), Prisma 7, Vitest, Zod.

**Spec:** No separate spec document. This plan is derived from three things found in the code on `main` at `7ccf7c7`:
- `components/event-intake-form.tsx:11-12,139` — event type is a **hidden input hardcoded to `DINNER_PARTY`**. There is no picker.
- Conflict data (`adviseNight`, `competingEvents`, `nightLoads`) is imported in exactly one file — `app/(app)/events/[id]/page.tsx` — which a host only reaches *after* the event exists.
- `app/(app)/events/[id]/guests/page.tsx:68-70` — a TODO naming PR #48 as its unblocking condition. #48 merged in `6fe399e`; the TODO is stale.

## Why this, and not what was planned before

The previous draft of this plan wired the model-backed `draftPlan` into the redraft button. **That is dropped.** Its stated rationale in `lib/ai/client.ts:8-10` — drafting for "an event type nobody wrote a template for" — cannot happen: `EVENT_TEMPLATES` is typed `Record<EventType, EventTemplate>`, a total record, so a missing template is a compile error. All 10 types have hand-written templates producing a 6-task universal spine plus type-specific extras plus budget-ordered booking tasks.

The real problem was never that the templates are thin. It is that **the host cannot reach them.** Every event created on the web is a `DINNER_PARTY` because that is the only thing the form can submit. Fixing that is Task 1, and it is what makes the other two worth having.

## Where this leads (context, not scope)

The end-state is HostKit carrying a host end to end: choose the night → plan it → fill it → run it on the day → learn from it. This plan does the **choose and plan** half, on deterministic data HostKit already owns and nothing else has. That ordering is deliberate: a model that drafts plans is only as useful as the signal underneath it, and until Task 1 lands every plan it drafts is a dinner party.

The model layer (`lib/ai/client.ts` — validated, fallback-backed, off without a key) stays exactly where it is for this plan. Aiming it properly is a separate piece of work that deserves its own spec; see the closing note.

## Global Constraints

- Node `>=20.19.0` (`package.json` engines).
- **Server actions and page components are not unit tested in this repo.** Every file in `tests/unit/` targets a pure `lib/` module; `tests/unit/conflicts.test.ts` tests only the pure half of a file that also holds queries. Do not add a database mock — put the rule in a pure function and test that.
- **Never trust a client-supplied identity.** The night check reads the host's school from the session, never from a form field.
- **Say nothing when there is nothing to say.** `components/night-advice.tsx:34` returns `null` unless the night is `busy`; the create-flow warning follows the same rule. A warning that fires every time gets ignored.
- No new npm dependencies. No schema change — this plan needs no migration.
- Commit messages: imperative, sentence case, **no** `feat:`/`fix:` prefix — match `git log`. End each commit message with:
  `Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa`
- Verification: `npm run lint`, `npm run typecheck`, `npm test`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/catalog.ts` | Modify (append) | Gains `EVENT_TYPE_OPTIONS` — the ordered, labelled picker list. |
| `tests/unit/catalog.test.ts` | Create | Guards that every `EventType` reaches the picker. |
| `components/event-intake-form.tsx` | Modify (11-12, 139, 192, 257, and the date `Row` at 180-182) | Type picker; defaults follow the chosen type; busy-night note under the date. |
| `lib/campus/conflicts.ts` | Modify (line 209) + two appends | Pure `loadForNight` extracted from `adviseNight`; `conflictCountFor` query; pure `nightNote`. |
| `tests/unit/conflicts.test.ts` | Modify (append) | Covers `loadForNight` and `nightNote`. |
| `lib/actions/night.ts` | Create | `checkNightAction` — session-scoped night lookup for the create form. |
| `app/(app)/events/new/page.tsx` | Modify | Passes `hasSchool` to the form. |
| `app/(app)/events/[id]/guests/page.tsx` | Modify (6-7, 56-72) | Real conflict count into `predictTurnout`. |

Tasks 1 and 3 touch disjoint files. Task 2 depends on `loadForNight` and `conflictCountFor`, which Task 3 also uses — **do Task 2 before Task 3**, or Task 3 first and Task 2 second; either order works as long as whichever runs first adds those two functions. The steps below put them in Task 2.

---

### Task 1: Let the host say what kind of night it is

The five event types added in #52 — and the five before them — are unreachable. This is the whole of that gap.

**Files:**
- Modify: `lib/catalog.ts` (append, after `ALL_EVENT_TYPES` at line 56)
- Test: `tests/unit/catalog.test.ts` (create — no catalog test file exists yet; `tests/unit/listing.test.ts` covers maps and listing, not this)
- Modify: `components/event-intake-form.tsx` lines 10-12, 139, 192, 257

**Interfaces:**
- Consumes: `EVENT_TYPE_LABEL: Record<EventType, string>` (`lib/catalog.ts:42`), `ALL_EVENT_TYPES: EventType[]` (`lib/catalog.ts:56`), `EVENT_TEMPLATES: Record<EventType, EventTemplate>` (`lib/templates.ts:118`).
- Produces: `EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }>` exported from `lib/catalog.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ALL_EVENT_TYPES, EVENT_TYPE_OPTIONS } from "@/lib/catalog";

describe("the event type picker", () => {
  // The bug this guards: for months the intake form submitted a hardcoded
  // DINNER_PARTY, so five types shipped in #52 that no host could choose.
  // A type added to the schema must reach the picker or fail here.
  it("offers every event type exactly once", () => {
    const values = EVENT_TYPE_OPTIONS.map((o) => o.value);

    expect([...values].sort()).toEqual([...ALL_EVENT_TYPES].sort());
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every option a human label", () => {
    for (const option of EVENT_TYPE_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
      expect(option.label).not.toBe(option.value);
    }
  });

  it("leads with the types students actually host", () => {
    expect(EVENT_TYPE_OPTIONS[0].value).toBe("MIXER");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: FAIL — `EVENT_TYPE_OPTIONS` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/catalog.ts`, after `ALL_EVENT_TYPES` (line 56):

```ts
/**
 * The picker, in the order a student host should meet it.
 *
 * Ordered rather than alphabetical because the front of this list is what
 * most people will pick, and the real usage that motivated the five new types
 * is student-organisation nights. Anything not named here still appears, in
 * schema order, so a new EventType can never go missing from the form — the
 * failure this list exists to prevent.
 */
const EVENT_TYPE_ORDER: EventType[] = [
  "MIXER",
  "GENERAL_MEETING",
  "STUDY_BREAK",
  "PITCH_NIGHT",
  "FORMAL",
  "DINNER_PARTY",
];

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  ...EVENT_TYPE_ORDER,
  ...ALL_EVENT_TYPES.filter((t) => !EVENT_TYPE_ORDER.includes(t)),
].map((value) => ({ value, label: EVENT_TYPE_LABEL[value] }));
```

`EventType` is already imported at the top of `lib/catalog.ts` — do not add a duplicate import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: PASS, all three cases.

- [ ] **Step 5: Put the picker in the form**

In `components/event-intake-form.tsx`, replace lines 10-12:

```tsx
/** The night a host most often means when they open this form. The picker
 *  below can change it, and the plan, budget split and defaults all follow
 *  from whatever they choose. */
const DEFAULT_TYPE: EventType = "MIXER";
```

Add to the imports at the top of the file:

```tsx
import { CITIES, EVENT_TYPE_OPTIONS } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import type { EventType } from "@/generated/prisma/enums";
```

(Replace the existing `CITIES` import line rather than adding a second one.)

Inside `EventIntakeForm`, alongside the other `useState` calls near line 126:

```tsx
  const [type, setType] = useState<EventType>(DEFAULT_TYPE);
  // Duration and capacity defaults belong to the chosen night, not to a
  // hardcoded one — a study break is not a formal.
  const template = EVENT_TEMPLATES[type];
```

Delete the module-level `const template = ...` you replaced in the edit above, so only this one remains.

Replace the hidden input at line 139 with nothing (delete the line), and add a real row to the date panel — put it directly above the `Date` row at line 180:

```tsx
          <Row label="Kind">
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className={compact}
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Row>
```

Lines 192 and 257 already read `template.defaultDurationHours` and `template.defaultGuestCount`; they now follow the picker with no further change.

- [ ] **Step 6: Verify the defaults actually move**

`defaultValue` on an uncontrolled input does **not** update on re-render. Check `components/event-intake-form.tsx:192` and `:257`:
- Line 192's duration input uses `defaultValue={template.defaultDurationHours}` — add `key={type}` to that input so React remounts it when the type changes.
- Line 257's `<CapacityField ... defaultValue={template.defaultGuestCount} />` holds its own `useState` — add `key={type}` to the `CapacityField` element for the same reason.

Without these, picking "Formal" leaves the dinner-party numbers in place and the host silently gets the wrong defaults.

- [ ] **Step 7: Fix the end-to-end spec this breaks**

`tests/e2e/spine.spec.ts` creates a night and then asserts on the plan it generates. It was written when the type was hardcoded, and it says so at lines 46-47:

```
// Every night is planned from the dinner-party template (there is no
// kind-of-night picker): catering is the one essential booking.
```

That comment is now false, and the assertions depend on it: `DINNER_PARTY` has `required: ["CATERING"]` and a 30-day horizon, while the new default `MIXER` has `required: ["VENUE"]` and 21 days — so `"1 essential booking outstanding"` at line 72 is asserting about a different category than the test intends.

Do **not** re-tune the assertions to `MIXER`. Keep the test's intent and make the choice explicit, which also gives the new picker its first bit of coverage. Replace the comment above `createNight` with:

```ts
// This night is deliberately planned from the dinner-party template, chosen
// through the picker: catering is the one essential booking.
```

And add a line to `createNight`, directly after `await page.goto("/events/new");` at line 49:

```ts
  await page.selectOption('select[name="type"]', "DINNER_PARTY");
```

- [ ] **Step 8: Verify types, lint and tests**

Run: `npm run typecheck`
Expected: PASS. `createEventAction` already validates `type` against `ALL_EVENT_TYPES` (`lib/actions/events.ts:23`), so the server accepts every value the picker can emit — no server change needed.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Run the end-to-end spec**

Run: `npx playwright test tests/e2e/spine.spec.ts`
Expected: PASS. This is the task's real gate — the unit tests cannot see a form that submits the wrong type. If it fails on a plan assertion, the `selectOption` line from Step 7 is missing or the selector does not match the `<select name="type">` you added.

- [ ] **Step 10: Commit**

```bash
git add lib/catalog.ts tests/unit/catalog.test.ts components/event-intake-form.tsx tests/e2e/spine.spec.ts
git commit -m "$(cat <<'EOF'
Let a host say what kind of night they are throwing

The intake form submitted a hidden, hardcoded DINNER_PARTY, so the ten
templates behind it were unreachable and every event on the web was a
dinner party. The picker orders student nights first, and the duration and
capacity defaults now follow the choice.

EVENT_TYPE_OPTIONS is derived from ALL_EVENT_TYPES so a type added to the
schema cannot go missing from the form again; the test asserts it.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

### Task 2: Tell the host the night is crowded *before* they commit

The campus feed can already answer "is that Thursday busy" — but only on a page reached after the event exists and people have been told. This moves the answer to the date field.

**Files:**
- Modify: `lib/campus/conflicts.ts` (line 209, plus two appends)
- Test: `tests/unit/conflicts.test.ts` (append)
- Create: `lib/actions/night.ts`
- Modify: `app/(app)/events/new/page.tsx`
- Modify: `components/event-intake-form.tsx` (the date `Row`)

**Interfaces:**
- Consumes: `nightLoads(schoolDomain, from: Date, days: number): Promise<NightLoad[]>` (`lib/campus/conflicts.ts:155`), `nightOf(when: Date): Date` (`:90`), `toWallClock(local: Date): Date` (`:69`), `busyness(count: number): Busyness` (`:59`), `NightLoad = { night: Date; count: number }` (`:44`), `currentProfile()` (`lib/session.ts:22`).
- Produces: `loadForNight(loads: NightLoad[], night: Date): NightLoad`, `conflictCountFor(schoolDomain: string | null | undefined, start: Date | null | undefined): Promise<number | null>`, `nightNote(count: number): { level: Busyness; line: string } | null` — all exported from `lib/campus/conflicts.ts`. `checkNightAction(date: string): Promise<{ count: number; line: string } | null>` exported from `lib/actions/night.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/conflicts.test.ts`. Add `loadForNight` and `nightNote` to the existing import block starting on line 2.

```ts
describe("the load for one night", () => {
  it("finds the night in a run of them", () => {
    const loads = [
      { night: new Date("2026-09-24T00:00:00Z"), count: 14 },
      { night: new Date("2026-09-25T00:00:00Z"), count: 2 },
    ];

    expect(loadForNight(loads, new Date("2026-09-24T00:00:00Z")).count).toBe(14);
  });

  // "Nothing else is on" is a real answer, so a miss must not read as undefined.
  it("reports an empty night when the run doesn't reach it", () => {
    const night = new Date("2026-10-01T00:00:00Z");

    expect(loadForNight([], night)).toEqual({ night, count: 0 });
  });
});

describe("the note under the date field", () => {
  // Same rule as the overview panel: a warning that fires on every night
  // teaches people to ignore it.
  it("says nothing about a quiet or ordinary night", () => {
    expect(nightNote(0)).toBeNull();
    expect(nightNote(3)).toBeNull();
    expect(nightNote(11)).toBeNull();
  });

  it("speaks up once the night is busy, and counts the competition", () => {
    const note = nightNote(14);

    expect(note).not.toBeNull();
    expect(note?.level).toBe("busy");
    expect(note?.line).toContain("14");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/conflicts.test.ts`
Expected: FAIL — `loadForNight is not a function` / `nightNote is not a function`.

- [ ] **Step 3: Add the two pure functions**

In `lib/campus/conflicts.ts`, add both immediately after `betterNights` (which ends at line 125) and **before** the `// Queries` banner at lines 127-129, so they sit with the other pure functions:

```ts
/**
 * The load recorded for one night, or an empty night when the run doesn't
 * cover it. Pulled out of adviseNight so a caller that wants only the number
 * asks the same question the panel does, rather than a second, drifting one.
 */
export function loadForNight(loads: NightLoad[], night: Date): NightLoad {
  return loads.find((l) => l.night.getTime() === night.getTime()) ?? { night, count: 0 };
}

/**
 * One line for the host, at the moment they pick a date — or nothing at all.
 *
 * Silent on a quiet or ordinary night, on purpose and for the same reason
 * NightAdvicePanel is: this fires while someone is filling in a form, and a
 * note that always appears is furniture, not advice.
 */
export function nightNote(count: number): { level: Busyness; line: string } | null {
  const level = busyness(count);
  if (level !== "busy") return null;

  return {
    level,
    line: `${count} other things are already on that evening at your school. Quieter nights are usually easier to fill.`,
  };
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
 * One night, so one query. Null when there is no school or no date, which
 * predictTurnout reads as "ordinary night".
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

- [ ] **Step 6: Add the server action**

Create `lib/actions/night.ts`:

```ts
"use server";

import { currentProfile } from "@/lib/session";
import { conflictCountFor, nightNote } from "@/lib/campus/conflicts";

/**
 * What else is on, for a date the host is still typing.
 *
 * The school comes from the session, never from the form: this is read-only
 * public campus data, but a client that can name any school is a client that
 * can probe any school, and there is no reason to allow it.
 *
 * Returns null when there is nothing to say — no school on the profile, an
 * unparseable date, or an evening that isn't busy.
 */
export async function checkNightAction(
  date: string,
): Promise<{ count: number; line: string } | null> {
  const profile = await currentProfile();
  if (!profile?.schoolDomain || !date) return null;

  // The date input gives a bare YYYY-MM-DD. Campus nights are evenings —
  // NIGHT_FROM_HOUR is 17 — so check the evening of the chosen day rather
  // than midnight, which would bucket into the night before.
  const evening = new Date(`${date}T20:00:00`);
  if (Number.isNaN(evening.getTime())) return null;

  const count = await conflictCountFor(profile.schoolDomain, evening);
  if (count === null) return null;

  const note = nightNote(count);
  return note ? { count, line: note.line } : null;
}
```

- [ ] **Step 7: Pass the school flag into the form**

In `app/(app)/events/new/page.tsx`, replace lines 8-9:

```tsx
  const user = await getCurrentUser();
  const profile = user ? await currentProfile() : null;
  const clubs = user ? (await clubsFor(user.id)).map((c) => ({ id: c.id, name: c.name })) : [];
```

Add `currentProfile` to the existing `@/lib/session` import on line 2:

```tsx
import { currentProfile, getCurrentUser } from "@/lib/session";
```

And pass the flag at line 20:

```tsx
      <EventIntakeForm
        signedIn={Boolean(user)}
        clubs={clubs}
        hasSchool={Boolean(profile?.schoolDomain)}
      />
```

- [ ] **Step 8: Show the note under the date field**

In `components/event-intake-form.tsx`, add `hasSchool` to the props (lines 117-124):

```tsx
export function EventIntakeForm({
  signedIn,
  clubs = [],
  hasSchool = false,
}: {
  signedIn: boolean;
  /** Clubs the host manages — "Post as". */
  clubs?: Array<{ id: string; name: string }>;
  /** Whether the host's profile names a school, so there is a campus to check. */
  hasSchool?: boolean;
}) {
```

Add to the imports:

```tsx
import { checkNightAction } from "@/lib/actions/night";
```

Add state alongside the others near line 126:

```tsx
  const [nightLine, setNightLine] = useState<string | null>(null);
```

Replace the date `Row` (lines 180-182) with:

```tsx
          <Row label="Date">
            <input
              name="date"
              type="date"
              className={compact}
              onChange={(e) => {
                const value = e.target.value;
                if (!hasSchool || !value) {
                  setNightLine(null);
                  return;
                }
                // Advisory only: a failure here must never block the form, so
                // there is no error state — the note simply doesn't appear.
                void checkNightAction(value)
                  .then((note) => setNightLine(note?.line ?? null))
                  .catch(() => setNightLine(null));
              }}
            />
          </Row>
          {nightLine ? (
            <div className="bg-amber-wash px-4 py-3 text-[13px] text-amber">{nightLine}</div>
          ) : null}
```

The `amber-wash` / `amber` pair is what `components/night-advice.tsx:40-45` already uses for this exact signal, so the two surfaces read as one idea.

- [ ] **Step 9: Verify types, lint and tests**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Check it by hand**

Run: `npm run dev`

Sign in as a seeded student whose profile names a school, open `/events/new`, and put a date on a night the seeded campus feed is busy. Expect the amber line under the date field. Change to a quiet night: expect it to disappear. Sign out, open `/events/new` again: expect no note and no error, since there is no school.

- [ ] **Step 11: Commit**

```bash
git add lib/campus/conflicts.ts lib/actions/night.ts tests/unit/conflicts.test.ts app/\(app\)/events/new/page.tsx components/event-intake-form.tsx
git commit -m "$(cat <<'EOF'
Warn about a crowded night while the host can still change it

#48 computed what else is on and showed it on the event overview — a page
you reach after the date is set and people have been told. The same answer
now appears under the date field, where changing your mind is free.

The school comes from the session rather than the form, and the note stays
silent on an ordinary night for the same reason the overview panel does.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

### Task 3: Let a busy night lower the turnout estimate

`predictTurnout` has accepted a `conflicts` count since #49 and the guests page has passed `null` ever since. Task 2 added the query; this connects it.

**Files:**
- Modify: `app/(app)/events/[id]/guests/page.tsx` lines 6-7 and 56-72

**Interfaces:**
- Consumes: `conflictCountFor` from Task 2; `predictTurnout(input: TurnoutInput): TurnoutBand` (`lib/turnout.ts:141`), whose `conflicts?: number | null` sits at `lib/turnout.ts:91`.
- Produces: nothing new.

- [ ] **Step 1: Confirm the behaviour is already covered**

Run: `npx vitest run tests/unit/turnout.test.ts`
Expected: PASS. `tests/unit/turnout.test.ts:118-119` already asserts a busy night produces a lower estimate than a quiet one, and `:58-64` covers `conflictMultiplier` at and below the threshold. This task adds no new rule, so it adds no new unit test — it removes a hardcoded `null`.

- [ ] **Step 2: Wire the count in**

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

The stale `// The campus conflict count plugs in here once #48 lands` comment must be gone. No copy change is needed on the card: `lib/turnout.ts:187-189` already pushes "It is a busy night on campus, which usually costs a little turnout." into `basis`, and the page already renders `turnout.basis`.

- [ ] **Step 3: Verify types, lint and tests**

Run: `npm run typecheck`
Expected: PASS — `conflictCountFor` returns `number | null`; `TurnoutInput.conflicts` is `number | null | undefined`.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/events/\[id\]/guests/page.tsx
git commit -m "$(cat <<'EOF'
Let a busy campus night lower the turnout estimate

#49 took a conflicts count and passed null; #48 shipped the data and the
two were never joined. The basis line explaining it was already written.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

## Final verification

- [ ] **Run the gate CI runs**

```bash
npm run lint
npm run typecheck
npm test
```

All three must pass. CI additionally runs `npx prisma migrate deploy` against a throwaway Postgres and then Playwright (`.github/workflows/ci.yml`). No task here changes the schema.

Both Task 1 and Task 2 change the create form that `tests/e2e/spine.spec.ts` drives, so **run the full end-to-end suite before pushing**:

```bash
npm run test:e2e
```

Task 2 in particular attaches an `onChange` to `input[name="date"]`, which the spec fills at line 51 — the handler fires during the test. It is advisory and swallows its own errors, so it should not affect the run, but a failure here is the place that would show it.

- [ ] **Push and open the PR**

```bash
git push -u origin wire-phase4-signals
```

## Self-review notes

Checked against the three findings under **Spec**:

1. **Coverage** — the hardcoded `DINNER_PARTY` is removed in Task 1 Step 5; the conflict data reaches the date field in Task 2 Step 8; the stale TODO is deleted in Task 3 Step 2. All three findings are closed.
2. **Placeholders** — none; every code step carries the literal text to write.
3. **Type consistency** — `EVENT_TYPE_OPTIONS` yields `EventType`, which `createEventAction`'s `z.enum(ALL_EVENT_TYPES)` accepts; `nightNote` returns `Busyness`, the same union `busyness()` produces; `conflictCountFor` returns `number | null`, which `TurnoutInput.conflicts` accepts; `checkNightAction` returns the `{ count, line }` shape the form's `setNightLine` reads.

**Deliberately out of scope**, and each wanting its own spec before anyone writes code:

- **Aiming the model.** `draftPlan` still has no caller. Once Task 1 lands, hosts will be choosing real types and the templates behind them get exercised for the first time — that is the evidence needed to decide whether a model adds anything to a plan, and where. Decide after, not before.
- **The execution half.** The run sheet is the artifact a host actually holds on the night, and it is the natural home for an agent that helps *run* an event rather than plan one. Nothing in this plan touches it.
- **A type picker on iOS.** `ios/HostKit/Networking/Models.swift` decodes `EventKind`; the app has the same gap the web form had. Out of scope here, worth its own task.
