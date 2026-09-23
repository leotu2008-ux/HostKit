# Hosty Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the event agent read as a character, "Hosty" the ghost, talking to the host in a chat. This covers the Overview thread, the side panel, the sidebar status and the landing page, and changes no data or API.

**Architecture:** A pure `lib/hosty-voice.ts` turns existing activity rows and briefings into first-person chat messages at render time. A `HostyMark` SVG component draws the ghost. Presentational components (`ChatThread`, the reworked `AgentPanel`/`AgentCard`, `AgentStatusLine`, the landing pill and preview) render them. `ActivityFeed`'s polling is untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 tokens (`bg-sunk`, `bg-brand`, `text-ink`, `text-ink-mute`, `text-amber`, `border-line`), Vitest (`environment: "node"`, tests in `tests/unit/**/*.test.ts`, render tests via `renderToStaticMarkup` + `createElement`).

**Spec:** `docs/superpowers/specs/2026-09-23-hosty-chat-design.md`

## Global Constraints

- No schema, migration, API route or server-action behavior changes. `mergeFeed`, `briefingFor` and the activity API stay as they are.
- No model calls. `lib/ai/briefing-voice.ts` is not touched.
- Hosty's sentences only reuse words and numbers already in the row or briefing. Every number in a Hosty sentence must pass `numbersAreGrounded` (from `lib/agent/briefing.ts`) against the numbers in the source row.
- The agent's name in user-facing copy is exactly `Hosty`.
- Ghost SVG, exact: `viewBox="0 0 100 100"`; path `M22 50 A28 28 0 0 1 78 50 V80 q-7 8 -14 0 t-14 0 t-14 0 L17 94 L22 72 Z` (`fill="none" stroke="currentColor" strokeWidth={7} strokeLinejoin="round"`); eyes `ellipse cx=41 cy=52 rx=4 ry=6.5` and `cx=59`, `fill="currentColor"`.
- Tests: **no source-grep tests** (never read a component's source and match strings). Execute functions or render components and assert on the output. Test files are `.test.ts`, so use `createElement`, not JSX.
- Frozen areas (iOS, clubs, discover, campus, draft claiming) are not touched.
- Every task ends green on: `npx vitest run <its test files>`, then `npm run typecheck`.
- Commits: one per task, on branch `hosty-chat`, messages in the repo's plain-sentence style.

## Review Focus

1. **A single venue or inquiry**: "1 venue lined up" / body "Back Bay" should read "I lined up 1 venue: Back Bay. Nothing's been sent." (singular, no list). Test in Task 2.
2. **Older plan rows without the source part**: body "13 tasks · 4 budget categories" (saved before "from the template" existed) should read "I drafted your plan: 13 tasks and 4 budget categories." with no dangling second sentence. Test in Task 2.
3. **Host names with extra spaces, or blank**: "  Leo Tu " should greet "Hi Leo,", and "" or null should greet "Hi,". Test in Task 2 (`firstNameOf`) and Task 4 (panel).
4. **A system note between two Hosty messages**: it must split them into two Hosty groups, each with its own "Hosty · time" header, so the note isn't swallowed or misplaced. Test in Task 3.
5. **Agent running with no feed rows yet**: show the typing indicator, not the "Fill in the brief and I'll get going." prompt, because Hosty is already going. Test in Task 3.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `components/hosty-mark.tsx` | create | The ghost SVG |
| `lib/hosty-voice.ts` | create | Rows → chat messages, briefing greeting, first name, list joining |
| `components/chat-thread.tsx` | create | Presentational chat thread (client: scroll stickiness) |
| `components/activity-feed.tsx` | modify | Render via `toChatThread` + `ChatThread`; polling unchanged |
| `components/agent-panel.tsx` | modify | Hosty header + one greeting bubble with item rows |
| `components/agent-card.tsx` | modify | Card → compact `<li>` row; `AgentCardAction` unchanged |
| `app/(workspace)/events/[id]/layout.tsx` | modify | Pass `firstName` to `AgentPanel` |
| `components/workspace-sidebar.tsx` | modify | Export `AgentStatusLine`, speak as Hosty with the mark |
| `app/(workspace)/events/[id]/brief/page.tsx` | modify | "What Hosty still needs" copy |
| `components/landing.tsx` | modify | Hero pill with the mark and "Meet Hosty…" |
| `components/landing-preview.tsx` | modify | Right column speaks as Hosty |
| `tests/unit/hosty-mark.test.ts` | create | |
| `tests/unit/hosty-voice.test.ts` | create | |
| `tests/unit/chat-thread.test.ts` | create | |
| `tests/unit/agent-panel.test.ts` | create | |
| `tests/unit/agent-status-line.test.ts` | create | |
| `tests/unit/landing-motion.test.ts` | modify | New pill and preview copy |

---

### Task 1: The ghost mark

**Files:**
- Create: `components/hosty-mark.tsx`
- Test: `tests/unit/hosty-mark.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function HostyMark(props: { size?: number; className?: string; title?: string }): React.JSX.Element`. The default size is 20. Without `title` it's `aria-hidden="true"`; with `title` it's `role="img"` plus `aria-label` and a `<title>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/hosty-mark.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HostyMark } from "@/components/hosty-mark";

describe("HostyMark", () => {
  it("draws the ghost in currentColor at the requested size, hidden from screen readers by default", () => {
    const html = renderToStaticMarkup(createElement(HostyMark, { size: 32 }));
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('viewBox="0 0 100 100"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
  });

  it("defaults to 20px", () => {
    const html = renderToStaticMarkup(createElement(HostyMark));
    expect(html).toContain('width="20"');
  });

  it("becomes a labelled image when given a title", () => {
    const html = renderToStaticMarkup(createElement(HostyMark, { title: "Hosty" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hosty"');
    expect(html).toContain("<title>Hosty</title>");
    expect(html).not.toContain("aria-hidden");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/hosty-mark.test.ts`
Expected: FAIL, "Failed to resolve import "@/components/hosty-mark"".

- [ ] **Step 3: Implement**

```tsx
// components/hosty-mark.tsx
/**
 * Hosty, the event agent: an outline ghost whose last hem bump is a speech
 * tail, with two eyes. Drawn in currentColor so it takes the ink of whatever
 * it sits in. Decorative by default. Pass `title` where the mark is the only
 * thing naming Hosty.
 */
export function HostyMark({
  size = 20,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      focusable="false"
      {...a11y}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M22 50 A28 28 0 0 1 78 50 V80 q-7 8 -14 0 t-14 0 t-14 0 L17 94 L22 72 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <ellipse cx={41} cy={52} rx={4} ry={6.5} fill="currentColor" />
      <ellipse cx={59} cy={52} rx={4} ry={6.5} fill="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/hosty-mark.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/hosty-mark.tsx tests/unit/hosty-mark.test.ts
git commit -m "Draw Hosty: an outline ghost with a speech tail, in currentColor."
```

---

### Task 2: Hosty's voice

**Files:**
- Create: `lib/hosty-voice.ts`
- Test: `tests/unit/hosty-voice.test.ts`

**Interfaces:**
- Consumes: `FeedRow` from `@/lib/activity-format` (`{ id, actor: "agent"|"host"|"system", kind, title, body: string|null, href: string|null, createdAt: string }`), and `Briefing` from `@/lib/agent/briefing` (`{ items, counts: { now, soon, total }, headline }`).
- Produces:
  - `export type ChatSpeaker = "hosty" | "you" | "note"`
  - `export type ChatMessage = { id: string; speaker: ChatSpeaker; text: string; action?: { label: string; href: string }; createdAt: string }`
  - `export function toChatMessage(row: FeedRow): ChatMessage`
  - `export function toChatThread(rows: FeedRow[]): ChatMessage[]` (oldest first; ties broken by id ascending)
  - `export function briefingIntro(briefing: Briefing, firstName: string | null): string`
  - `export function firstNameOf(name: string | null | undefined): string | null`
  - `export function naturalList(items: string[]): string`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/hosty-voice.test.ts
import { describe, expect, it } from "vitest";
import type { FeedRow } from "@/lib/activity-format";
import { numbersAreGrounded, type Briefing, type BriefingItem } from "@/lib/agent/briefing";
import {
  briefingIntro,
  firstNameOf,
  naturalList,
  toChatMessage,
  toChatThread,
} from "@/lib/hosty-voice";

const row = (over: Partial<FeedRow>): FeedRow => ({
  id: "r1",
  actor: "agent",
  kind: "plan_drafted",
  title: "",
  body: null,
  href: null,
  createdAt: "2026-09-23T19:00:00.000Z",
  ...over,
});

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

describe("toChatMessage: Hosty's lines", () => {
  const cases: Array<[string, Partial<FeedRow>, string]> = [
    ["run started", { kind: "run_started", title: "The agent is working on this" }, "On it. Let me take a look."],
    [
      "plan from the template",
      { kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories · from the template" },
      "I drafted your plan: 13 tasks and 4 budget categories. I used the standard template for now.",
    ],
    [
      "plan written by the model",
      { kind: "plan_drafted", title: "Plan drafted", body: "9 tasks · 3 budget categories · written for this event" },
      "I drafted your plan: 9 tasks and 3 budget categories. I wrote it for this event.",
    ],
    [
      "plan saved before the source was recorded",
      { kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories" },
      "I drafted your plan: 13 tasks and 4 budget categories.",
    ],
    [
      "three venues",
      {
        kind: "venues_attached",
        title: "3 venues lined up",
        body: "Back Bay Events Center · Somerville Studios Event Space · Southie Event Spaces",
      },
      "I lined up 3 venues: Back Bay Events Center, Somerville Studios Event Space and Southie Event Spaces. Nothing's been sent.",
    ],
    [
      "one venue",
      { kind: "venues_attached", title: "1 venue lined up", body: "Back Bay Events Center" },
      "I lined up 1 venue: Back Bay Events Center. Nothing's been sent.",
    ],
    ["no venues", { kind: "venue_search_empty", title: "No venues turned up nearby" }, "I couldn't find venues nearby yet."],
    [
      "two inquiries",
      { kind: "inquiries_drafted", title: "2 vendor inquiries drafted", body: "Catering · AV & production" },
      "I drafted 2 vendor inquiries: catering and AV & production. They're waiting for you to send.",
    ],
    [
      "one inquiry",
      { kind: "inquiries_drafted", title: "1 vendor inquiry drafted", body: "Catering" },
      "I drafted 1 vendor inquiry: catering. It's waiting for you to send.",
    ],
    [
      "no vendors",
      { kind: "inquiries_drafted", title: "No vendors to draft for" },
      "I couldn't find vendors in the catalog that fit this date yet.",
    ],
    [
      "skipped with a reason",
      { kind: "step_skipped", title: "Didn't look for venues", body: "You already have a venue" },
      "I didn't look for venues. You already have a venue.",
    ],
    ["skipped without a reason", { kind: "step_skipped", title: "Skipped the plan" }, "I skipped the plan."],
    [
      "failed",
      { kind: "step_failed", title: "Couldn't find venues", body: "timeout" },
      "I couldn't find venues. I'll try again on the next run.",
    ],
    ["finished", { kind: "run_finished", title: "The agent finished" }, "All done for now."],
    [
      "finished with problems",
      { kind: "run_finished", title: "The agent finished with problems" },
      "Done, but a couple of things didn't work.",
    ],
    ["already running", { kind: "run_finished", title: "The agent is already on it" }, "I'm already on it."],
    [
      "rate limited",
      { kind: "run_finished", title: "Too many runs this hour — try again later" },
      "I've run a lot this hour. Try me again a bit later.",
    ],
    [
      "couldn't start",
      { kind: "run_finished", title: "The agent couldn't start" },
      "I couldn't get started. Try again in a moment.",
    ],
  ];

  it.each(cases)("%s", (_name, over, expected) => {
    const message = toChatMessage(row(over));
    expect(message.speaker).toBe("hosty");
    expect(message.text).toBe(expected);
  });

  it.each(cases)("%s never invents a number", (_name, over) => {
    const source = row(over);
    const message = toChatMessage(source);
    expect(numbersAreGrounded(message.text, numbersIn(`${source.title} ${source.body ?? ""}`))).toBe(true);
  });

  it("falls back to the saved title and body for a kind it doesn't know, still as Hosty", () => {
    const message = toChatMessage(row({ kind: "brand_new_step", title: "Did a new thing", body: "3 of them" }));
    expect(message).toMatchObject({ speaker: "hosty", text: "Did a new thing — 3 of them" });
  });

  it("falls back when a known kind's title doesn't match the expected shape", () => {
    const message = toChatMessage(row({ kind: "venues_attached", title: "Venues attached" }));
    expect(message.text).toBe("Venues attached");
  });
});

describe("toChatMessage: the host and the system", () => {
  it("turns a brief save into your own line", () => {
    const message = toChatMessage(
      row({ actor: "host", kind: "brief_saved", title: "Brief updated", body: "Title · Date · City" }),
    );
    expect(message).toMatchObject({ speaker: "you", text: "Updated the brief: title, date and city" });
  });

  it("reads a manual run as you asking Hosty", () => {
    const message = toChatMessage(
      row({ actor: "host", kind: "run_started", title: "You asked the agent to take another look" }),
    );
    expect(message).toMatchObject({ speaker: "you", text: "Asked Hosty to take another look" });
  });

  it("keeps other host lines as saved", () => {
    const message = toChatMessage(row({ actor: "host", kind: "task_done", title: "Done: Book the venue" }));
    expect(message).toMatchObject({ speaker: "you", text: "Done: Book the venue" });
  });

  it("shows system rows as a note with just the title", () => {
    const message = toChatMessage(
      row({
        actor: "system",
        kind: "event_created",
        title: "Event created",
        body: "Fill in the brief and the agent gets going.",
      }),
    );
    expect(message).toMatchObject({ speaker: "note", text: "Event created" });
  });
});

describe("toChatMessage: actions", () => {
  it("labels the link by kind", () => {
    expect(toChatMessage(row({ kind: "plan_drafted", title: "Plan drafted", href: "/events/e1/plan" })).action).toEqual({
      label: "Open the plan",
      href: "/events/e1/plan",
    });
    expect(
      toChatMessage(row({ kind: "venues_attached", title: "2 venues lined up", href: "/events/e1/venue" })).action,
    ).toEqual({ label: "See the venues", href: "/events/e1/venue" });
    expect(
      toChatMessage(row({ kind: "inquiries_drafted", title: "1 vendor inquiry drafted", href: "/events/e1/outreach" }))
        .action,
    ).toEqual({ label: "Review the drafts", href: "/events/e1/outreach" });
  });

  it("uses Open for any other linked row, and no action without a link", () => {
    expect(toChatMessage(row({ actor: "host", kind: "published", title: "Published", href: "/e/e1" })).action).toEqual({
      label: "Open",
      href: "/e/e1",
    });
    expect(toChatMessage(row({ kind: "run_started", title: "x" })).action).toBeUndefined();
  });
});

describe("toChatThread", () => {
  it("orders oldest first, breaking same-instant ties by id", () => {
    const rows = [
      row({ id: "b", createdAt: "2026-09-23T19:02:00.000Z", kind: "run_started", title: "x" }),
      row({ id: "c", createdAt: "2026-09-23T19:01:00.000Z", kind: "run_started", title: "x" }),
      row({ id: "a", createdAt: "2026-09-23T19:02:00.000Z", kind: "run_started", title: "x" }),
    ];
    expect(toChatThread(rows).map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
});

describe("naturalList", () => {
  it("joins zero, one, two and three items the way a person would", () => {
    expect(naturalList([])).toBe("");
    expect(naturalList(["A"])).toBe("A");
    expect(naturalList(["A", "B"])).toBe("A and B");
    expect(naturalList(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("firstNameOf", () => {
  it("takes the first word of a trimmed name, or null when there isn't one", () => {
    expect(firstNameOf("  Leo Tu ")).toBe("Leo");
    expect(firstNameOf("Leo")).toBe("Leo");
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});

describe("briefingIntro", () => {
  const item = (urgency: "now" | "soon", id: string): BriefingItem => ({
    id,
    kind: "task_due",
    urgency,
    title: id,
    detail: "",
    action: { type: "complete_task", taskId: id, label: "Mark done" },
  });
  const briefing = (now: number, soon: number): Briefing => ({
    eventId: "e1",
    items: [
      ...Array.from({ length: now }, (_, i) => item("now", `n${i}`)),
      ...Array.from({ length: soon }, (_, i) => item("soon", `s${i}`)),
    ],
    counts: { now, soon, total: now + soon },
    headline: "",
  });

  it("says all quiet when there's nothing", () => {
    expect(briefingIntro(briefing(0, 0), "Leo")).toBe("All quiet. Nothing needs you today.");
  });

  it("says nothing's urgent when everything is upcoming", () => {
    expect(briefingIntro(briefing(0, 1), "Leo")).toBe("Hi Leo, nothing's urgent. One thing is coming up:");
    expect(briefingIntro(briefing(0, 3), "Leo")).toBe("Hi Leo, nothing's urgent. 3 things are coming up:");
  });

  it("leads with what needs the host today", () => {
    expect(briefingIntro(briefing(1, 0), "Leo")).toBe("Hi Leo, one thing needs you today:");
    expect(briefingIntro(briefing(1, 1), "Leo")).toBe("Hi Leo, one thing needs you today and one is coming up:");
    expect(briefingIntro(briefing(1, 4), "Leo")).toBe("Hi Leo, one thing needs you today and 4 are coming up:");
    expect(briefingIntro(briefing(2, 0), "Leo")).toBe("Hi Leo, 2 things need you today:");
    expect(briefingIntro(briefing(2, 3), "Leo")).toBe("Hi Leo, 2 things need you today and 3 are coming up:");
  });

  it("drops the name when there isn't one", () => {
    expect(briefingIntro(briefing(1, 0), null)).toBe("Hi, one thing needs you today:");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/hosty-voice.test.ts`
Expected: FAIL, "Failed to resolve import "@/lib/hosty-voice"".

- [ ] **Step 3: Implement**

```ts
// lib/hosty-voice.ts
import type { FeedRow } from "@/lib/activity-format";
import type { Briefing } from "@/lib/agent/briefing";

/**
 * Hosty's voice: what the agent and the host did, as chat lines.
 *
 * Pure and deterministic (no model), and grounded: a sentence here only
 * reuses words and numbers already saved on the row, so Hosty can't say
 * anything the feed didn't record. Rows are phrased when shown, not when
 * saved, so old history reads the same way. A kind nobody taught this file
 * still shows up, as its saved title and body.
 */

export type ChatSpeaker = "hosty" | "you" | "note";

export type ChatMessage = {
  id: string;
  speaker: ChatSpeaker;
  text: string;
  action?: { label: string; href: string };
  createdAt: string;
};

const SPEAKER: Record<FeedRow["actor"], ChatSpeaker> = {
  agent: "hosty",
  host: "you",
  system: "note",
};

const ACTION_LABEL: Record<string, string> = {
  plan_drafted: "Open the plan",
  venues_attached: "See the venues",
  inquiries_drafted: "Review the drafts",
};

const RUN_FINISHED: Record<string, string> = {
  "The agent finished": "All done for now.",
  "The agent finished with problems": "Done, but a couple of things didn't work.",
  "The agent is already on it": "I'm already on it.",
  "Too many runs this hour — try again later": "I've run a lot this hour. Try me again a bit later.",
  "The agent couldn't start": "I couldn't get started. Try again in a moment.",
};

const PLAN_SOURCE: Record<string, string> = {
  "from the template": "I used the standard template for now.",
  "written for this event": "I wrote it for this event.",
};

/** The agent steps save lists as "A · B · C". */
function parts(body: string | null): string[] {
  return (body ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** ["A"] → "A", ["A", "B"] → "A and B", ["A", "B", "C"] → "A, B and C". */
export function naturalList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Lowercases a leading capital only when it starts an ordinary word, so
 *  "Catering" becomes "catering" but "AV & production" keeps its acronym. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z']/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** Ends `text` with a full stop unless it already ends a sentence. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function hostyText(row: FeedRow): string | null {
  switch (row.kind) {
    case "run_started":
      return "On it. Let me take a look.";
    case "run_finished":
      return RUN_FINISHED[row.title] ?? null;
    case "plan_drafted": {
      const all = parts(row.body);
      const source = all.find((part) => part in PLAN_SOURCE);
      const counts = all.filter((part) => part !== source);
      const lead = counts.length > 0 ? `I drafted your plan: ${naturalList(counts)}.` : "I drafted your plan.";
      return source ? `${lead} ${PLAN_SOURCE[source]}` : lead;
    }
    case "venues_attached": {
      const count = row.title.match(/^(\d+) venues? lined up$/);
      if (!count) return null;
      const n = Number(count[1]);
      const names = parts(row.body);
      const list = names.length > 0 ? `: ${naturalList(names)}` : "";
      return `I lined up ${n} ${n === 1 ? "venue" : "venues"}${list}. Nothing's been sent.`;
    }
    case "venue_search_empty":
      return "I couldn't find venues nearby yet.";
    case "inquiries_drafted": {
      if (row.title === "No vendors to draft for") {
        return "I couldn't find vendors in the catalog that fit this date yet.";
      }
      const count = row.title.match(/^(\d+) vendor inquir(?:y|ies) drafted$/);
      if (!count) return null;
      const n = Number(count[1]);
      const kinds = parts(row.body).map(lowerFirst);
      const list = kinds.length > 0 ? `: ${naturalList(kinds)}` : "";
      const waiting = n === 1 ? "It's waiting for you to send." : "They're waiting for you to send.";
      return `I drafted ${n} vendor ${n === 1 ? "inquiry" : "inquiries"}${list}. ${waiting}`;
    }
    case "step_skipped": {
      const lead = `I ${lowerFirst(sentence(row.title))}`;
      return row.body ? `${lead} ${sentence(row.body)}` : lead;
    }
    case "step_failed":
      return `I ${lowerFirst(sentence(row.title))} I'll try again on the next run.`;
    default:
      return null;
  }
}

function youText(row: FeedRow): string | null {
  switch (row.kind) {
    case "brief_saved": {
      const fields = parts(row.body).map(lowerFirst);
      return fields.length > 0 ? `Updated the brief: ${naturalList(fields)}` : "Updated the brief";
    }
    case "run_started":
      return "Asked Hosty to take another look";
    default:
      return null;
  }
}

export function toChatMessage(row: FeedRow): ChatMessage {
  const speaker = SPEAKER[row.actor];
  const phrased =
    speaker === "hosty" ? hostyText(row) : speaker === "you" ? youText(row) : row.title;
  const text = phrased ?? (row.body ? `${row.title} — ${row.body}` : row.title);
  return {
    id: row.id,
    speaker,
    text,
    createdAt: row.createdAt,
    ...(row.href ? { action: { label: ACTION_LABEL[row.kind] ?? "Open", href: row.href } } : {}),
  };
}

/** The feed as a chat reads it: oldest first. `mergeFeed` keeps rows newest
 *  first for the poller, so the flip happens here, at display time. */
export function toChatThread(rows: FeedRow[]): ChatMessage[] {
  return [...rows]
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    })
    .map(toChatMessage);
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** The side panel's opening line. */
export function briefingIntro(briefing: Briefing, firstName: string | null): string {
  const { now, soon, total } = briefing.counts;
  if (total === 0) return "All quiet. Nothing needs you today.";
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  if (now === 0) {
    return `${hi} nothing's urgent. ${soon === 1 ? "One thing is" : `${soon} things are`} coming up:`;
  }
  const today = now === 1 ? "one thing needs you today" : `${now} things need you today`;
  const upcoming = soon === 0 ? "" : soon === 1 ? " and one is coming up" : ` and ${soon} are coming up`;
  return `${hi} ${today}${upcoming}:`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/hosty-voice.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`. Expected: no errors.

```bash
git add lib/hosty-voice.ts tests/unit/hosty-voice.test.ts
git commit -m "Give Hosty a voice: phrase feed rows and the briefing in the first person, from what was saved."
```

---

### Task 3: The chat thread on the Overview

**Files:**
- Create: `components/chat-thread.tsx`
- Modify: `components/activity-feed.tsx` (imports, the `ACTOR_DOT` constant, and the render block from `{rows.length === 0 ? (` to the closing `)}` before `</Frame>`)
- Test: `tests/unit/chat-thread.test.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `toChatThread` (Task 2); `HostyMark` (Task 1); `relativeTime` from `@/lib/activity-format`; `cx` from `@/components/ui`.
- Produces: `export function ChatThread(props: { messages: ChatMessage[]; running: boolean; now: Date; eventId: string }): React.JSX.Element`, where `messages` is oldest first.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/chat-thread.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

import { ChatThread } from "@/components/chat-thread";
import { ActivityFeed } from "@/components/activity-feed";
import type { ChatMessage } from "@/lib/hosty-voice";
import type { FeedRow } from "@/lib/activity-format";

const NOW = new Date("2026-09-23T20:00:00.000Z");
const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "m",
  speaker: "hosty",
  text: "",
  createdAt: "2026-09-23T19:58:00.000Z",
  ...over,
});
const render = (messages: ChatMessage[], running = false) =>
  renderToStaticMarkup(createElement(ChatThread, { messages, running, now: NOW, eventId: "e1" }));

describe("ChatThread", () => {
  it("keeps the order it's given, oldest first", () => {
    const html = render([msg({ id: "1", text: "First" }), msg({ id: "2", text: "Second" })]);
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
  });

  it("puts one Hosty header over consecutive Hosty messages", () => {
    const html = render([msg({ id: "1", text: "One" }), msg({ id: "2", text: "Two" })]);
    expect(html.match(/data-speaker="hosty"/g)?.length).toBe(1);
    expect(html.match(/>Hosty</g)?.length).toBe(1);
    expect(html).toContain("One");
    expect(html).toContain("Two");
  });

  it("starts a new Hosty group after a note", () => {
    const html = render([
      msg({ id: "1", text: "Before" }),
      msg({ id: "2", speaker: "note", text: "Event created" }),
      msg({ id: "3", text: "After" }),
    ]);
    expect(html.match(/data-speaker="hosty"/g)?.length).toBe(2);
    expect(html.indexOf("Before")).toBeLessThan(html.indexOf("Event created"));
    expect(html.indexOf("Event created")).toBeLessThan(html.indexOf("After"));
  });

  it("shows the host's own lines as theirs and system lines as notes", () => {
    const html = render([
      msg({ id: "1", speaker: "you", text: "Updated the brief" }),
      msg({ id: "2", speaker: "note", text: "Event created" }),
    ]);
    expect(html).toContain('data-speaker="you"');
    expect(html).toContain('data-speaker="note"');
    expect(html).toContain("You: </span>Updated the brief");
  });

  it("prefixes every bubble with its speaker for screen readers", () => {
    const html = render([msg({ id: "1", text: "Hello" })]);
    expect(html).toContain('<span class="sr-only">Hosty: </span>Hello');
  });

  it("renders a message's action as a link inside the bubble", () => {
    const html = render([msg({ id: "1", text: "Plan", action: { label: "Open the plan", href: "/events/e1/plan" } })]);
    expect(html).toContain('href="/events/e1/plan"');
    expect(html).toContain("Open the plan");
  });

  it("shows the typing indicator only while Hosty is running", () => {
    expect(render([msg({ id: "1", text: "x" })], true)).toContain("Hosty is typing");
    expect(render([msg({ id: "1", text: "x" })], false)).not.toContain("Hosty is typing");
  });

  it("invites the host to fill in the brief when there's nothing yet", () => {
    const html = render([]);
    expect(html).toContain("Fill in the brief and I");
    expect(html).toContain('href="/events/e1/brief"');
  });

  it("shows typing instead of the invitation when Hosty is already running on an empty thread", () => {
    const html = render([], true);
    expect(html).toContain("Hosty is typing");
    expect(html).not.toContain("Fill in the brief");
  });
});

describe("ActivityFeed", () => {
  const row = (over: Partial<FeedRow>): FeedRow => ({
    id: "r",
    actor: "agent",
    kind: "run_started",
    title: "The agent is working on this",
    body: null,
    href: null,
    createdAt: "2026-09-23T19:58:00.000Z",
    ...over,
  });

  it("renders the newest-first feed as an oldest-first chat in Hosty's voice", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityFeed, {
        eventId: "e1",
        initial: [
          row({ id: "2", kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories", createdAt: "2026-09-23T19:59:00.000Z" }),
          row({ id: "1", createdAt: "2026-09-23T19:58:00.000Z" }),
        ],
        agent: { status: "running", lastRunAt: null, startedAt: null, needs: [] },
        now: NOW.toISOString(),
      }),
    );
    expect(html).toContain("What&#x27;s happening");
    expect(html.indexOf("On it. Let me take a look.")).toBeLessThan(
      html.indexOf("I drafted your plan: 13 tasks and 4 budget categories."),
    );
    expect(html).toContain("Hosty is typing");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/chat-thread.test.ts`
Expected: FAIL, "Failed to resolve import "@/components/chat-thread"".

- [ ] **Step 3: Implement `ChatThread`**

```tsx
// components/chat-thread.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HostyMark } from "@/components/hosty-mark";
import { relativeTime } from "@/lib/activity-format";
import type { ChatMessage, ChatSpeaker } from "@/lib/hosty-voice";
import { cx } from "@/components/ui";

/**
 * The Overview's feed as a chat with Hosty. Presentational: the caller owns
 * polling and passes messages oldest first. Consecutive messages from the
 * same speaker share one header; a note always stands alone.
 *
 * Scrolling sticks to the newest message only while the reader is already
 * near the bottom, so a poll never yanks them out of history they're reading.
 */

const STICK_PX = 80;

type Group = { speaker: ChatSpeaker; messages: ChatMessage[] };

function groupMessages(messages: ChatMessage[]): Group[] {
  const groups: Group[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === message.speaker && message.speaker !== "note") {
      last.messages.push(message);
    } else {
      groups.push({ speaker: message.speaker, messages: [message] });
    }
  }
  return groups;
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunk text-ink"
    >
      <HostyMark size={18} />
    </span>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.speaker === "you";
  return (
    <div
      className={cx(
        "max-w-[34rem] rounded-2xl px-3 py-2 text-[13.5px] leading-snug",
        mine ? "rounded-tr-md bg-brand text-white" : "rounded-tl-md bg-sunk text-ink",
      )}
    >
      <span className="sr-only">{mine ? "You: " : "Hosty: "}</span>
      {message.text}
      {message.action ? (
        <div className="mt-2">
          <Link
            href={message.action.href}
            className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink hover:bg-sunk"
          >
            {message.action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Typing() {
  return (
    <li className="flex items-start gap-2.5" aria-label="Hosty is typing">
      <Avatar />
      <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-sunk px-3 py-2.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-mute"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">Hosty is typing</span>
    </li>
  );
}

export function ChatThread({
  messages,
  running,
  now,
  eventId,
}: {
  messages: ChatMessage[];
  running: boolean;
  now: Date;
  eventId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, running]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  }

  const shown: ChatMessage[] =
    messages.length === 0 && !running
      ? [
          {
            id: "hosty-empty",
            speaker: "hosty",
            text: "Fill in the brief and I'll get going.",
            action: { label: "Open the brief", href: `/events/${eventId}/brief` },
            createdAt: now.toISOString(),
          },
        ]
      : messages;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="max-h-[28rem] overflow-y-auto pr-1">
      <ol aria-live="polite" className="space-y-3">
        {groupMessages(shown).map((group) => {
          const first = group.messages[0];
          const last = group.messages[group.messages.length - 1];
          if (group.speaker === "note") {
            return (
              <li key={first.id} data-speaker="note" className="text-center text-[11px] text-ink-mute">
                {first.text} · {relativeTime(first.createdAt, now)}
              </li>
            );
          }
          if (group.speaker === "you") {
            return (
              <li key={first.id} data-speaker="you" className="flex flex-col items-end gap-1.5">
                {group.messages.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
                <p className="text-[11px] text-ink-mute">You · {relativeTime(last.createdAt, now)}</p>
              </li>
            );
          }
          return (
            <li key={first.id} data-speaker="hosty" className="flex items-start gap-2.5">
              <Avatar />
              <div className="min-w-0 space-y-1.5">
                <p className="text-[12px] text-ink-mute">
                  <span className="font-semibold text-ink">Hosty</span> · {relativeTime(first.createdAt, now)}
                </p>
                {group.messages.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
              </div>
            </li>
          );
        })}
        {running ? <Typing /> : null}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `ActivityFeed`**

In `components/activity-feed.tsx`:

Replace the imports:

```tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AgentStatusView } from "@/lib/activity";
import { actorLabel, feedIsQuiet, latestAt, mergeFeed, relativeTime, type FeedRow } from "@/lib/activity-format";
import { Card, SectionHeading, EmptyState, cx } from "@/components/ui";
```

with:

```tsx
import { useEffect, useRef, useState } from "react";
import type { AgentStatusView } from "@/lib/activity";
import { feedIsQuiet, latestAt, mergeFeed, type FeedRow } from "@/lib/activity-format";
import { toChatThread } from "@/lib/hosty-voice";
import { ChatThread } from "@/components/chat-thread";
import { Card, SectionHeading } from "@/components/ui";
```

Delete the `ACTOR_DOT` constant (the `const ACTOR_DOT: Record<FeedRow["actor"], string> = { … };` block).

Replace the whole render block from `{rows.length === 0 ? (` through its closing `)}` (just before `</Frame>`) with:

```tsx
      <ChatThread
        messages={toChatThread(rows)}
        running={agent.status === "running"}
        now={clock}
        eventId={eventId}
      />
```

Leave everything else (state, refs, the polling effect, `SectionHeading` and its paused/resume action, `CardFrame`, `PlainFrame`) exactly as it is.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/chat-thread.test.ts tests/unit/activity-format.test.ts`
Expected: PASS. `activity-format` is unchanged and still passes.

- [ ] **Step 6: Typecheck, lint and commit**

Run: `npm run typecheck && npx eslint components/chat-thread.tsx components/activity-feed.tsx`
Expected: no errors. If eslint reports `FeedRow` as unused in `activity-feed.tsx`, it's still used by the props and `useState<FeedRow[]>`, so leave it. If `relativeTime` or `Link` imports are left over, remove them.

```bash
git add components/chat-thread.tsx components/activity-feed.tsx tests/unit/chat-thread.test.ts
git commit -m "Show the Overview feed as a chat with Hosty: oldest first, grouped, typing while he works."
```

---

### Task 4: The side panel as Hosty's message

**Files:**
- Modify: `components/agent-panel.tsx` (whole component)
- Modify: `components/agent-card.tsx` (the `AgentCard` function and its imports; `AgentCardAction` unchanged)
- Modify: `app/(workspace)/events/[id]/layout.tsx:72-78` (the `<AgentPanel … />` element) plus one import
- Test: `tests/unit/agent-panel.test.ts`

**Interfaces:**
- Consumes: `briefingIntro`, `firstNameOf` (Task 2); `HostyMark` (Task 1); `Briefing`/`BriefingItem` from `@/lib/agent/briefing`.
- Produces: `AgentPanel` gains the prop `firstName: string | null`. `AgentCard` now renders an `<li>`, so it must sit inside a `<ul>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/agent-panel.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("@/lib/actions/tasks", () => ({ toggleTaskAction: vi.fn() }));

import { AgentPanel } from "@/components/agent-panel";
import type { Briefing } from "@/lib/agent/briefing";

const briefing: Briefing = {
  eventId: "e1",
  items: [
    {
      id: "task_due:t1",
      kind: "task_due",
      urgency: "now",
      title: "Lock the date, the headcount and the budget",
      detail: "Everything downstream keys off these three numbers.",
      action: { type: "complete_task", taskId: "t1", label: "Mark done" },
    },
    {
      id: "venue_missing:e1",
      kind: "venue_missing",
      urgency: "soon",
      title: "Book the venue",
      detail: "Nothing booked for the space.",
      action: { type: "open_plan", label: "Open the plan" },
    },
  ],
  counts: { now: 1, soon: 1, total: 2 },
  headline: "1 thing needs you today",
};

const render = (b: Briefing, firstName: string | null = "Leo") =>
  renderToStaticMarkup(
    createElement(AgentPanel, { briefing: b, eventId: "e1", canSend: true, venueSearchEnabled: true, firstName }),
  );

describe("AgentPanel", () => {
  it("speaks as Hosty and greets the host by name", () => {
    const html = render(briefing);
    expect(html).toContain(">Hosty<");
    expect(html).toContain("1 thing needs you today");
    expect(html).toContain("Hi Leo, one thing needs you today and one is coming up:");
  });

  it("lists every item with its one action", () => {
    const html = render(briefing);
    expect(html).toContain("Lock the date, the headcount and the budget");
    expect(html).toContain("Mark done");
    expect(html).toContain('name="taskId" value="t1"');
    expect(html).toContain("Book the venue");
    expect(html).toContain('href="/events/e1/plan"');
    expect(html.match(/<li /g)?.length).toBe(2);
  });

  it("keeps each item's detail for screen readers and as a tooltip", () => {
    const html = render(briefing);
    expect(html).toContain('title="Everything downstream keys off these three numbers."');
    expect(html).toContain('<span class="sr-only">Everything downstream keys off these three numbers.</span>');
  });

  it("marks what needs the host today apart from what's coming up", () => {
    const html = render(briefing);
    expect(html).toContain("Needs you today");
    expect(html).toContain("Coming up");
  });

  it("says all quiet, with no list, when there's nothing", () => {
    const html = render({ eventId: "e1", items: [], counts: { now: 0, soon: 0, total: 0 }, headline: "" });
    expect(html).toContain("All quiet. Nothing needs you today.");
    expect(html).not.toContain("<ul");
  });

  it("greets without a name when there isn't one", () => {
    expect(render(briefing, null)).toContain("Hi, one thing needs you today");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/agent-panel.test.ts`
Expected: FAIL. The TypeScript prop `firstName` is unknown, and "Hi Leo…" isn't found.

- [ ] **Step 3: Rewrite `AgentPanel`**

Replace the full contents of `components/agent-panel.tsx` with:

```tsx
import { AgentCard } from "@/components/agent-card";
import { HostyMark } from "@/components/hosty-mark";
import type { Briefing } from "@/lib/agent/briefing";
import { briefingIntro } from "@/lib/hosty-voice";

/**
 * Hosty's latest message, as a persistent rail beside every stage page for
 * one event. A pure view of the Briefing lib/agent/load.ts already computed:
 * it never computes anything of its own and never calls the model, so it
 * can't say anything the digest wouldn't.
 *
 * It's always present, so a host can glance at the same spot on every page,
 * but it doesn't manufacture work to fill the space. When the briefing is
 * empty, Hosty says so in one line and stops.
 */
export function AgentPanel({
  briefing,
  eventId,
  canSend,
  venueSearchEnabled,
  firstName,
  className,
}: {
  briefing: Briefing;
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
  firstName: string | null;
  className?: string;
}) {
  return (
    <aside aria-labelledby="agent-heading" className={className}>
      <h2 id="agent-heading" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <HostyMark size={20} />
        <span>Hosty</span>
        {briefing.headline ? (
          <span className="text-[13px] font-normal text-ink-mute">· {briefing.headline}</span>
        ) : null}
      </h2>

      <div className="mt-3 rounded-2xl rounded-tl-md bg-sunk p-3.5">
        <p className="text-[13.5px] leading-snug text-ink">{briefingIntro(briefing, firstName)}</p>
        {briefing.items.length > 0 ? (
          <ul className="mt-2.5 divide-y divide-line">
            {briefing.items.map((item) => (
              <AgentCard
                key={item.id}
                item={item}
                eventId={eventId}
                canSend={canSend}
                venueSearchEnabled={venueSearchEnabled}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Turn `AgentCard` into a row**

In `components/agent-card.tsx`, change the first import line from:

```tsx
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
```

to:

```tsx
import { Button, ButtonLink, cx } from "@/components/ui";
```

Replace the doc comment and the `AgentCard` function (everything above `function AgentCardAction`) with:

```tsx
/**
 * One row in Hosty's message, one action. The panel is a list of things that
 * need the host, not a menu of ways to respond, so every row ends in exactly
 * one button. The switch below is exhaustive: a new BriefingAction variant
 * fails to compile here until this file knows how to render it.
 *
 * The detail line lives in the row's tooltip and in screen-reader text, so
 * the message stays short without losing it.
 */
export function AgentCard({
  item,
  eventId,
  canSend,
  venueSearchEnabled,
}: {
  item: BriefingItem;
  eventId: string;
  canSend: boolean;
  venueSearchEnabled: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2" title={item.detail}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{item.title}</p>
        <p className={cx("text-[12px]", item.urgency === "now" ? "text-amber" : "text-ink-mute")}>
          {item.urgency === "now" ? "Needs you today" : "Coming up"}
        </p>
        <span className="sr-only">{item.detail}</span>
      </div>
      <div className="shrink-0">
        <AgentCardAction
          action={item.action}
          eventId={eventId}
          canSend={canSend}
          venueSearchEnabled={venueSearchEnabled}
        />
      </div>
    </li>
  );
}
```

Leave `AgentCardAction` exactly as it is.

- [ ] **Step 5: Pass the first name from the layout**

In `app/(workspace)/events/[id]/layout.tsx`, add the import next to the other `@/lib` imports:

```tsx
import { firstNameOf } from "@/lib/hosty-voice";
```

and add the prop to the `<AgentPanel` element (after `venueSearchEnabled={isVenueSearchConfigured()}`):

```tsx
              firstName={firstNameOf(user?.name)}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/agent-panel.test.ts tests/unit/briefing.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors. `AgentPanel` has exactly one call site, the layout; if typecheck finds another, pass `firstName={null}` there.

```bash
git add components/agent-panel.tsx components/agent-card.tsx "app/(workspace)/events/[id]/layout.tsx" tests/unit/agent-panel.test.ts
git commit -m "Make the side panel Hosty's message: a greeting, then what needs you, each with its one button."
```

---

### Task 5: The sidebar status and the Brief tab speak as Hosty

**Files:**
- Modify: `components/workspace-sidebar.tsx`: `AgentStatusLine` (lines ~74–132) is exported and rewritten; the `dotClass` constant (line 52) is deleted; the status card's "Agent" label (around line 258) is removed
- Modify: `app/(workspace)/events/[id]/brief/page.tsx:79-83`
- Test: `tests/unit/agent-status-line.test.ts`

**Interfaces:**
- Consumes: `HostyMark` (Task 1); `AgentStatusView` from `@/lib/activity`.
- Produces: `export function AgentStatusLine(props: { eventId: string; agent: AgentStatusView; now: string })`, same props as today, now exported.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/agent-status-line.test.ts
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/events/e1" }));
vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { AgentStatusLine } from "@/components/workspace-sidebar";
import type { AgentStatusView } from "@/lib/activity";

const NOW = "2026-09-23T20:00:00.000Z";
const render = (over: Partial<AgentStatusView>) =>
  renderToStaticMarkup(
    createElement(AgentStatusLine, {
      eventId: "e1",
      now: NOW,
      agent: { status: "done", lastRunAt: null, startedAt: null, needs: [], ...over },
    }),
  );

describe("AgentStatusLine", () => {
  it("shows Hosty working, with the mark pulsing", () => {
    const html = render({ status: "running" });
    expect(html).toContain("Hosty is working on this…");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('viewBox="0 0 100 100"');
  });

  it("shows a queued run as about to start", () => {
    expect(render({ status: "queued" })).toContain("Hosty will start soon");
  });

  it("says what Hosty needs from the brief, linking to it", () => {
    const html = render({ status: "idle", needs: ["date", "city"] });
    expect(html).toContain("Hosty needs");
    expect(html).toContain('href="/events/e1/brief"');
  });

  it("offers a retry when the last run failed", () => {
    const html = render({ status: "failed" });
    expect(html).toContain("Hosty’s last run didn’t finish");
    expect(html).toContain("Try again");
  });

  it("rests with the time of the last run and offers another", () => {
    const html = render({ status: "done", lastRunAt: "2026-09-23T19:59:00.000Z" });
    expect(html).toContain("Hosty is resting · ran 1m ago");
    expect(html).toContain("Run again");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/agent-status-line.test.ts`
Expected: FAIL, because `AgentStatusLine` isn't exported (`undefined` element type).

- [ ] **Step 3: Rewrite `AgentStatusLine`**

In `components/workspace-sidebar.tsx`:

Add the import after the `CreateEventButton` import:

```tsx
import { HostyMark } from "@/components/hosty-mark";
```

Delete the line:

```tsx
const dotClass = "h-1.5 w-1.5 shrink-0 rounded-full";
```

Replace the entire `function AgentStatusLine({ … }) { … }` with:

```tsx
export function AgentStatusLine({
  eventId,
  agent,
  now,
}: {
  eventId: string;
  agent: AgentStatusView;
  now: string;
}) {
  const mark = (pulse = false) => (
    <HostyMark size={20} className={cx("shrink-0 text-ink", pulse && "animate-pulse")} />
  );

  if (agent.status === "running") {
    return (
      <>
        {mark(true)}
        <span className="text-ink-soft">Hosty is working on this…</span>
      </>
    );
  }
  if (agent.status === "queued") {
    // A run the rate limit parked: nothing went wrong and nothing is lost,
    // because the cron sweep picks QUEUED rows up. Without its own branch this
    // read as idle, offering a "Run again" that would only queue again.
    return (
      <>
        {mark()}
        <span className="text-ink-soft">Hosty will start soon</span>
      </>
    );
  }
  if (agent.needs.length > 0) {
    return (
      <>
        {mark()}
        <Link href={`/events/${eventId}/brief`} className="text-ink-soft hover:text-ink">
          Hosty needs {describeMissing(agent.needs)}
        </Link>
      </>
    );
  }
  if (agent.status === "failed") {
    return (
      <>
        {mark()}
        <span className="text-ink-soft">Hosty&rsquo;s last run didn&rsquo;t finish</span>
        <RunAgainButton eventId={eventId} label="Try again" />
      </>
    );
  }
  return (
    <>
      {mark()}
      <span className="text-ink-soft">
        Hosty is resting
        {/* `now` comes from the server render so this string is the same on
            both sides of hydration. */}
        {agent.lastRunAt ? ` · ran ${relativeTime(agent.lastRunAt, new Date(now))}` : ""}
      </span>
      <RunAgainButton eventId={eventId} label="Run again" />
    </>
  );
}
```

In the status card further down, delete the label line so the mark and sentence carry the name:

```tsx
          <p className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">Agent</p>
```

and change the wrapper's top margin from `mt-1 flex` to `flex`:

```tsx
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
```

- [ ] **Step 4: Brief tab copy**

In `app/(workspace)/events/[id]/brief/page.tsx`, change:

```tsx
        <h2 className="text-sm font-semibold text-ink">What the agent still needs</h2>
```

to:

```tsx
        <h2 className="text-sm font-semibold text-ink">What Hosty still needs</h2>
```

and:

```tsx
            : "Saving this sets the agent going."}
```

to:

```tsx
            : "Saving this sets Hosty going."}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/agent-status-line.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck, lint and commit**

Run: `npm run typecheck && npx eslint components/workspace-sidebar.tsx "app/(workspace)/events/[id]/brief/page.tsx"`
Expected: no errors (in particular, no "dotClass is not defined": every use was inside `AgentStatusLine`).

```bash
git add components/workspace-sidebar.tsx "app/(workspace)/events/[id]/brief/page.tsx" tests/unit/agent-status-line.test.ts
git commit -m "Let the sidebar status and the Brief tab speak as Hosty, with his mark."
```

---

### Task 6: Hosty on the landing page

**Files:**
- Modify: `components/landing.tsx:134-141` (hero pill)
- Modify: `components/landing-preview.tsx` (the right column's `<Eyebrow>…</Eyebrow>`, around lines 204–217)
- Test: `tests/unit/landing-motion.test.ts` (update the existing assertions)

**Interfaces:**
- Consumes: `HostyMark` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Update the tests first**

In `tests/unit/landing-motion.test.ts`, in the `"renders the whole example on the server…"` test, replace:

```ts
    expect(html).toContain("It hands back");
```

with:

```ts
    expect(html).toContain(">Hosty<");
    expect(html).toContain("Here’s your plan for Thursday’s mixer:");
```

and replace:

```ts
    expect(html).not.toContain("Drafting");
```

with:

```ts
    expect(html).not.toContain("is typing");
```

In `"queues the hero lines to rise in order…"`, replace:

```ts
    expect(lines[0]).toContain("An agent for the whole event");
```

with:

```ts
    expect(lines[0]).toContain("Meet Hosty, an agent for the whole event");
    expect(lines[0]).toContain('viewBox="0 0 100 100"');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/landing-motion.test.ts`
Expected: FAIL on ">Hosty<" and "Meet Hosty…".

- [ ] **Step 3: Hero pill**

In `components/landing.tsx`, add the import beside the other component imports:

```tsx
import { HostyMark } from "@/components/hosty-mark";
```

and replace the pill's contents:

```tsx
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            An agent for the whole event
```

with:

```tsx
            <HostyMark size={16} className="text-ink" />
            Meet Hosty, an agent for the whole event
```

- [ ] **Step 4: Preview speaks as Hosty**

In `components/landing-preview.tsx`, add the import below the `Eyebrow` import:

```tsx
import { HostyMark } from "@/components/hosty-mark";
```

In the right-hand column (`<div className="bg-surface p-5">`), replace the whole `<Eyebrow>{frame.thinking ? ( … ) : ( "It hands back" )}</Eyebrow>` element with:

```tsx
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <HostyMark size={18} />
            <span>Hosty</span>
            {frame.thinking ? (
              <span className="preview-thinking font-normal text-ink-mute">
                is typing
                <span className="preview-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            ) : null}
          </div>
          <p
            className="preview-line mt-2 text-[14px] text-ink"
            data-in={frame.tasks > 0 ? "" : undefined}
          >
            Here&rsquo;s your plan for Thursday&rsquo;s mixer:
          </p>
```

Update the file's top doc comment sentence "the right-hand label thinks for a beat" to "Hosty types for a beat".

If `Eyebrow` is still used elsewhere in the file (the "You brief it" header uses it), keep its import.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/landing-motion.test.ts`
Expected: PASS, including the unchanged "pill first and the preview last" order check.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add components/landing.tsx components/landing-preview.tsx tests/unit/landing-motion.test.ts
git commit -m "Introduce Hosty on the landing page: the hero pill and the preview's reply."
```

---

### Task 7: Whole-branch verification

**Files:** none new.

- [ ] **Step 1: Full test suite, typecheck, lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, and lint prints no problems (worktrees are already ignored since PR #93).

- [ ] **Step 2: Look at it**

Run the dev server (`npm run dev`) against the local database from `.env`, open an event with activity, and check at 1440px and 390px wide:
- Overview: the thread reads oldest to newest, Hosty's bubbles are on the left with the ghost, "You" lines are on the right, notes are centered, and the action pills link correctly. Press "Run again" and watch the typing indicator appear, then Hosty's new messages.
- Any stage page: the side panel greets by first name, each row's button works (Mark done ticks the task off), and "All quiet" shows on an event with nothing due.
- The sidebar status shows the ghost and the Hosty sentences, and the Brief tab shows "What Hosty still needs".
- Landing (`/`, signed out): the pill shows the ghost and "Meet Hosty…"; the preview plays, with "Hosty is typing…" and then the opening line and tasks. With the OS set to reduce motion, the finished panel shows immediately.

- [ ] **Step 3: Record anything off**

Fix anything wrong in its owning task's files, with a test first where it's behavior. Commit each fix separately.
