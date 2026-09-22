# Signed-in App Blue Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every signed-in Hosty screen (`app/(app)/*` and the event workspace `app/(workspace)/*`) a blue palette with clearer contrast, without changing any layout and without touching the landing, Discover, public event or auth pages.

**Architecture:** Hosty's colours are Tailwind v4 `@theme` tokens (`--color-*` custom properties in `app/globals.css`), and components use them through utilities such as `bg-clay` and `text-ink-mute`. Both signed-in layouts get a `theme-app` marker class. A single `html:has(.theme-app)` rule then redefines the neutral and accent tokens for the whole document while a signed-in page is mounted. That covers the shared top bar and tab bar on those pages too, and it reverts as soon as you navigate back to a public page. A few components paint "selected" and "primary" with hard-coded `bg-ink`. Those move to the accent token. Outside the theme the accent token still resolves to ink, so public pages look the same as before.

**Tech Stack:** Next.js 16.3 (App Router, read `node_modules/next/dist/docs/` before touching routing), Tailwind CSS v4 `@theme` tokens, Vitest 4 (`environment: "node"`), Playwright e2e in CI.

**Spec:** There is no separate spec. The user asked to "improve the UI of the dashboard. keep the layout, but make everything clearer with the blue color palette. use the uiux pro max skill", then confirmed the scope is the **whole signed-in app**. The design decisions are recorded in the Design section below.

## Global Constraints

- The layout stays unchanged: no spacing, sizing, radius, typography, DOM-structure or copy changes.
- Public surfaces stay pixel-identical: `/` (landing), `/discover`, `/campus`, `/c/*`, `/e/*`, `/rsvp/*`, `(auth)` sign-in/sign-up. The base `@theme` values in `app/globals.css` do not change.
- Every text token must reach at least 4.5:1 against every ground it sits on (`surface`, `paper`, `sunk`), and `on-clay` must reach at least 4.5:1 on `clay` and on `clay-deep`. The unit test in Task 1 enforces both.
- The semantic status colours keep their meaning and values: `forest` (confirmed/booked), `amber` (attention), `danger` (destructive).
- Light only. `:root { color-scheme: light only; }` stays, and nothing is added for dark mode.
- Commit messages are plain sentences in the imperative (repo style, for example "Give the event buttons a light glass edge.").
- Ship through the no-mistakes gate (`git push no-mistakes <branch>`), not a direct push to `main`.

---

## Design

The palette comes from UI/UX Pro Max (`--domain color`, "Analytics Dashboard": blue data, primary `#1E40AF`, slate foregrounds, `#DBEAFE`-family borders) and was tuned against Hosty's existing brand blue `#1d4ed8`. The style comes from the design-system recommendation for a dense productivity dashboard: flat, no new shadows or gradients, hover as a colour shift only.

| Token | Now (warm mono) | Signed-in app (blue) | Role |
|---|---|---|---|
| `paper` | `#f8f8f7` | `#f5f8fc` | page ground |
| `surface` | `#ffffff` | `#ffffff` | cards |
| `sunk` | `#f0efed` | `#edf2f8` | wells, hover fills |
| `ink` | `#141414` | `#0f172a` | primary text |
| `ink-soft` | `#5c5a57` | `#44536a` | secondary text |
| `ink-mute` | `#8b8884` (**3.3–3.5:1, fails AA**) | `#5f6f86` (4.55–5.12:1) | hints, meta, timestamps |
| `line` | `#e7e6e3` | `#e1e7ef` | hairlines |
| `line-strong` | `#d5d3cf` | `#c3cedc` | input borders |
| `clay` (accent) | `#141414` | `#1d4ed8` | primary buttons, active state, focus ring, selection |
| `clay-deep` | `#000000` | `#1e40af` | primary hover, accent text on washes |
| `clay-wash` | `#ececea` | `#e6eefc` | active nav fill |
| `brand-wash` | `#e8f0fe` | `#e6eefc` | brand badges |

These are the clarity wins, in order of impact:
1. `ink-mute` is used 149 times and currently fails WCAG AA. Moving it to `#5f6f86` makes every hint, timestamp and meta line readable.
2. Primary actions, the focus ring and text selection turn blue. They're currently the same near-black as body text, so blue separates "things you act on" from "things you read".
3. The active workspace tab and section tab get a blue fill or underline instead of a white chip with a hairline ring, so you can tell at a glance where you are.
4. The neutrals move from warm grey to cool slate, so the blue sits in a coherent family rather than clashing with beige.

---

## File Structure

- `app/globals.css`: add the `html:has(.theme-app)` token block. It's the only CSS change.
- `app/(app)/layout.tsx`: add `theme-app` to the `<main>` class list.
- `app/(workspace)/layout.tsx`: add `theme-app` to the wrapper `<div>` class list.
- `tests/unit/app-theme.test.ts` (new): parses `globals.css` and enforces the contrast floors, the blue accent, and the unchanged base theme.
- `components/workspace-sidebar.tsx`, `components/section-nav.tsx`: active states use the accent.
- `components/outreach-card.tsx`, `components/inquiry-panel.tsx`, `components/blast-composer.tsx`, `components/calendar-picker.tsx`, `components/club-browse.tsx`, `components/activity-feed.tsx`, `app/(workspace)/events/[id]/(guests)/promote/page.tsx`: hard-coded `bg-ink` primaries and selections move to the `clay` tokens.
- `tests/unit/app-accent.test.ts` (new): stops those files from drifting back to hard-coded ink.

---

### Task 1: Blue token set, scoped to the signed-in app

**Files:**
- Create: `tests/unit/app-theme.test.ts`
- Modify: `app/globals.css` (insert after the `:root { color-scheme: light only; }` block, around line 70)
- Modify: `app/(app)/layout.tsx:6`
- Modify: `app/(workspace)/layout.tsx:19`

**Interfaces:**
- Consumes: the existing `@theme { ... }` block in `app/globals.css`.
- Produces: the CSS class `theme-app`. Any element carrying it switches the whole document to the blue tokens. Task 2 relies on `clay`, `clay-deep`, `clay-wash` and `on-clay` being blue under this class and monochrome outside it.

- [ ] **Step 1: Set up an isolated worktree**

Use superpowers:using-git-worktrees to create branch `app-blue-theme` from `main`. In the new worktree, run these one at a time (the worktree guard rejects compound commands):

```bash
npm ci
```
```bash
npx next typegen
```

Expected: both exit 0. `npm ci`'s postinstall generates the Prisma client.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/app-theme.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The signed-in app's blue palette lives in one CSS block. These tests read
 * the stylesheet itself, so a hand-tuned hex that drops below WCAG AA fails
 * here rather than in someone's eyes.
 */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** The `--color-*` declarations in the first block opened by `opener`. */
function tokens(opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`globals.css has no "${opener}" block`);
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries(
    [...body.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const base = tokens("@theme {");
const override = tokens("html:has(.theme-app) {");
const app = { ...base, ...override };

describe("signed-in app theme", () => {
  it("leaves the public pages' theme alone", () => {
    expect(base.clay).toBe("#141414");
    expect(base.paper).toBe("#f8f8f7");
    expect(base["ink-mute"]).toBe("#8b8884");
  });

  it("makes the accent blue", () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(app.clay.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r + 80);
    expect(b).toBeGreaterThan(g + 80);
  });

  const grounds = ["surface", "paper", "sunk"] as const;
  const texts = ["ink", "ink-soft", "ink-mute", "clay", "clay-deep", "forest", "amber", "danger"] as const;

  for (const text of texts) {
    for (const ground of grounds) {
      it(`${text} on ${ground} reaches 4.5:1`, () => {
        expect(contrast(app[text], app[ground])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it.each([
    ["on-clay", "clay"],
    ["on-clay", "clay-deep"],
    ["clay-deep", "clay-wash"],
    ["brand", "brand-wash"],
  ])("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(contrast(app[fg], app[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-theme.test.ts`
Expected: FAIL with `globals.css has no "html:has(.theme-app) {" block`.

- [ ] **Step 4: Add the token block**

In `app/globals.css`, directly after this block:

```css
:root {
  color-scheme: light only;
}
```

insert:

```css
/* The signed-in app: the same tokens, in blue.

   Both signed-in layouts — app/(app) and the event workspace — carry
   `theme-app`. While one is mounted, the whole document (top bar and tab
   bar included) takes these values; navigate back to a public page and the
   marker unmounts, so the landing, Discover and event pages keep the warm
   monochrome above. Cool slate neutrals so the blue sits in one family, and
   an ink-mute that clears WCAG AA — the warm one measured 3.3:1 on paper.
   tests/unit/app-theme.test.ts holds every pair to 4.5:1. */
html:has(.theme-app) {
  --color-paper: #f5f8fc;
  --color-surface: #ffffff;
  --color-sunk: #edf2f8;
  --color-ink: #0f172a;
  --color-ink-soft: #44536a;
  --color-ink-mute: #5f6f86;
  --color-line: #e1e7ef;
  --color-line-strong: #c3cedc;
  --color-clay: #1d4ed8;
  --color-clay-deep: #1e40af;
  --color-clay-wash: #e6eefc;
  --color-on-clay: #ffffff;
  --color-brand-wash: #e6eefc;
}
```

This works because Tailwind v4 compiles utilities such as `bg-clay` to `background-color: var(--color-clay)`, so redefining the custom property re-colours every utility beneath it. `html:has(.theme-app)` has specificity (0,1,1), which beats the `:root` (0,1,0) where `@theme` declares the base values.

- [ ] **Step 5: Mark both signed-in layouts**

`app/(app)/layout.tsx`: change

```tsx
    <main className="mx-auto w-full max-w-5xl flex-1 pb-4 md:px-4 md:py-6">
```

to

```tsx
    <main className="theme-app mx-auto w-full max-w-5xl flex-1 pb-4 md:px-4 md:py-6">
```

`app/(workspace)/layout.tsx`: change

```tsx
  return <div className="min-h-dvh">{children}</div>;
```

to

```tsx
  return <div className="theme-app min-h-dvh">{children}</div>;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-theme.test.ts`
Expected: PASS with 30 tests (2 named, 24 text-on-ground, 4 pairs).

- [ ] **Step 7: Run the full unit suite and typecheck**

Run: `npm test`
Expected: all suites pass.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css "app/(app)/layout.tsx" "app/(workspace)/layout.tsx" tests/unit/app-theme.test.ts
```
```bash
git commit -m "Paint the signed-in app blue, with muted text that clears AA."
```

---

### Task 2: Accent-coloured active and primary states

**Files:**
- Create: `tests/unit/app-accent.test.ts`
- Modify: `components/workspace-sidebar.tsx:241-246`
- Modify: `components/section-nav.tsx:40-41`
- Modify: `components/outreach-card.tsx:38`
- Modify: `components/inquiry-panel.tsx:44`
- Modify: `components/blast-composer.tsx:96`
- Modify: `components/calendar-picker.tsx:297`
- Modify: `components/club-browse.tsx:44`
- Modify: `components/activity-feed.tsx:24`
- Modify: `app/(workspace)/events/[id]/(guests)/promote/page.tsx:110`

**Interfaces:**
- Consumes: from Task 1, the `clay`, `clay-deep`, `clay-wash` and `on-clay` tokens (blue under `theme-app`, monochrome elsewhere).
- Produces: nothing later tasks depend on.

Line numbers are from `main` at `20684b6`. Match on the quoted strings, not the numbers.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app-accent.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Selected and primary controls in the signed-in app use the accent token,
 * which is blue there and ink everywhere else. A hard-coded `bg-ink` or
 * `border-ink` would stay black inside the blue app. Scrims such as
 * `bg-ink/30` are fine: the `/` suffix is excluded.
 */
const FILES = [
  "components/workspace-sidebar.tsx",
  "components/section-nav.tsx",
  "components/outreach-card.tsx",
  "components/inquiry-panel.tsx",
  "components/blast-composer.tsx",
  "components/calendar-picker.tsx",
  "components/club-browse.tsx",
  "components/activity-feed.tsx",
  "app/(workspace)/events/[id]/(guests)/promote/page.tsx",
];

const HARD_INK = /\b(?:bg|border)-ink(?![-/\w])/g;

describe("signed-in accent", () => {
  it.each(FILES)("%s paints selection and primaries with the accent", (file) => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    expect(source.match(HARD_INK) ?? []).toEqual([]);
  });

  it("marks the active workspace tab with the accent", () => {
    const source = readFileSync(new URL("../../components/workspace-sidebar.tsx", import.meta.url), "utf8");
    expect(source).toContain("bg-clay-wash font-medium text-clay-deep");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-accent.test.ts`
Expected: FAIL. The sidebar assertion fails, and these files report `bg-ink`/`border-ink` matches: `outreach-card`, `inquiry-panel`, `blast-composer`, `calendar-picker`, `club-browse`, `activity-feed`, `section-nav` and `promote/page`.

- [ ] **Step 3: Workspace sidebar active tab**

In `components/workspace-sidebar.tsx`, change

```tsx
                  active
                    ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-line"
                    : "text-ink-soft hover:bg-surface/70 hover:text-ink",
                )}
              >
                <span className={active ? "text-ink" : "text-ink-mute"}>
```

to

```tsx
                  active
                    ? "bg-clay-wash font-medium text-clay-deep"
                    : "text-ink-soft hover:bg-surface/70 hover:text-ink",
                )}
              >
                <span className={active ? "text-clay" : "text-ink-mute"}>
```

The row keeps its `h-9` and padding, so the layout doesn't move. Only the fill, the text colour and the dropped ring change.

- [ ] **Step 4: Section tabs underline**

In `components/section-nav.tsx`, change

```tsx
                active
                  ? "border-ink font-medium text-ink"
```

to

```tsx
                active
                  ? "border-clay font-medium text-clay-deep"
```

- [ ] **Step 5: Primary buttons in outreach and inquiry**

In `components/outreach-card.tsx`, change

```tsx
      className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-surface disabled:opacity-50"
```

to

```tsx
      className="h-9 rounded-full bg-clay px-4 text-sm font-medium text-on-clay hover:bg-clay-deep disabled:opacity-50"
```

In `components/inquiry-panel.tsx`, change

```tsx
      className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-surface disabled:opacity-50"
```

to

```tsx
      className="h-10 rounded-full bg-clay px-4 text-sm font-medium text-on-clay hover:bg-clay-deep disabled:opacity-50"
```

- [ ] **Step 6: Selected chips and dates**

In both `components/blast-composer.tsx` and `app/(workspace)/events/[id]/(guests)/promote/page.tsx`, change

```tsx
                        ? "border-ink bg-ink text-paper"
```

to

```tsx
                        ? "border-clay bg-clay text-on-clay"
```

(Indentation differs between the two files. Keep each file's own.)

In `components/calendar-picker.tsx`, change

```tsx
                        ? "bg-ink text-paper"
```

to

```tsx
                        ? "bg-clay text-on-clay"
```

In `components/club-browse.tsx`, change

```tsx
                active ? "border-ink bg-ink text-paper" :
```

to

```tsx
                active ? "border-clay bg-clay text-on-clay" :
```

- [ ] **Step 7: Agent dot in the activity feed**

In `components/activity-feed.tsx`, change

```tsx
  agent: "bg-ink",
```

to

```tsx
  agent: "bg-clay",
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-accent.test.ts`
Expected: PASS with 10 tests.

If a file still reports a match, grep it (`grep -n "bg-ink\|border-ink" <file>`) and apply the same swap: `bg-ink` becomes `bg-clay`, `border-ink` becomes `border-clay`, and the paired `text-paper`/`text-surface` becomes `text-on-clay`.

- [ ] **Step 9: Run lint, typecheck and the full suite**

Run: `npm run lint`
Expected: no errors in the files above. If the count is large, group the output by path first: stale `.claude/worktrees/*` checkouts add phantom errors.

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 10: Commit**

```bash
git add components/workspace-sidebar.tsx components/section-nav.tsx components/outreach-card.tsx components/inquiry-panel.tsx components/blast-composer.tsx components/calendar-picker.tsx components/club-browse.tsx components/activity-feed.tsx "app/(workspace)/events/[id]/(guests)/promote/page.tsx" tests/unit/app-accent.test.ts
```
```bash
git commit -m "Mark active tabs, selections and primary actions with the app's blue."
```

---

### Task 3: Visual verification and ship

**Files:** none changed unless verification finds a defect.

**Interfaces:**
- Consumes: Tasks 1 and 2 on branch `app-blue-theme`.
- Produces: a merged PR.

- [ ] **Step 1: Push through the gate**

```bash
git push no-mistakes app-blue-theme
```

Watch the run with `no-mistakes`. It reviews, runs the tests, pushes and opens the PR. If the PR shows only Vercel checks, close and reopen it to fire the Actions run.

- [ ] **Step 2: Check the Vercel preview, signed in as Maya**

The user signs in on the preview URL. Then screenshot each screen at 1440×900 and at 390×844:

1. `/events`: list, primary "Plan an event" button blue, meta lines readable.
2. `/events/<id>`: workspace sidebar active tab blue-washed, Overview panes, activity feed agent dots blue.
3. `/events/<id>/brief`: calendar picker selected date blue, input focus ring blue.
4. `/events/<id>/outreach`: send button blue, section tabs underlined blue.
5. `/events/<id>/blasts`: selected audience chip blue.
6. `/inbox`, `/clubs`, `/settings`: top bar and tab bar on cool paper, nothing warm-grey left over.
7. `/` (landing) and `/discover`: **unchanged**, still monochrome with warm paper. Compare against production.

Also check that tabbing through the workspace sidebar shows a blue focus ring that isn't hidden under the sticky workspace bar.

- [ ] **Step 3: Fix anything that reads as warm grey or stays black**

Any element that still paints ink where it means "selected" or "primary" gets the Task 2 swap in its own file. Add that file to `FILES` in `tests/unit/app-accent.test.ts` in the same commit. Leave layout alone.

- [ ] **Step 4: Merge**

When CI is green and the screenshots check out, merge the PR (the user's call) and confirm the production deploy.
