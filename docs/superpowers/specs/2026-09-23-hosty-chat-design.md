# Hosty: the agent as a chat

Date: 2026-09-23. Status: approved in brainstorming, awaiting spec review.

## Why

In the event workspace, the agent's output is hard to tell apart from a normal to-do list. The Overview's "What's happening" feed is a column of dot + label + title rows. The Agent side panel is a stack of task cards with "Now/Soon" badges and "Mark done" buttons. Nothing says *someone* is doing this work for you.

Goal: the agent reads as a character talking to the host. It has a name (**Hosty**), a face (a ghost) and a voice (first person). Its output looks like a chat.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| How far does "chat" go? | **Looks and sounds like chat.** No text box; the host can't type to Hosty yet. Uses existing data, no new model calls. |
| Which surfaces? | The Overview feed becomes the **thread**. The side panel (on every workspace page) becomes **Hosty's latest message**. The sidebar status speaks as Hosty. |
| Name | **Hosty.** System lines become small grey notes, not a second speaker. |
| Avatar | **Ghost "B", in black:** an outline ghost whose last hem bump is a speech tail, plus two oval eyes. No fill, no texture. Drawn in `currentColor`. |
| Where the wording comes from | **Phrased at render time** from each row's saved `kind`/`title`/`body`. The database and API are unchanged, and old history converts too. |
| Side panel layout | **A: one message with a list.** A greeting line, then the items as compact rows, each keeping its one action button. |
| Thread order | Oldest at top, newest at bottom (chat convention). |
| Landing page | Hosty in the **hero pill**, and the **preview panel speaks** as Hosty. No big floating mascot. |

Out of scope: two-way chat, model-written messages, changes to what the agent *does*, the model fallback bug (triage finding A), iOS, and other frozen areas.

## The mark

```svg
<svg viewBox="0 0 100 100">
  <path d="M22 50 A28 28 0 0 1 78 50 V80 q-7 8 -14 0 t-14 0 t-14 0 L17 94 L22 72 Z"
        fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
  <ellipse cx="41" cy="52" rx="4" ry="6.5" fill="currentColor"/>
  <ellipse cx="59" cy="52" rx="4" ry="6.5" fill="currentColor"/>
</svg>
```

It takes the app's ink color: `#0f172a` inside `.theme-app`, `#141414` on public pages. The mockups are kept in `.superpowers/brainstorm/` (gitignored); `ghost-final.html` and `chat-layout-v2.html` are the approved screens.

## Components

### 1. `components/hosty-mark.tsx` (new)
`HostyMark({ size = 20, className, title? })`: the SVG above. It's `aria-hidden` unless `title` is given, in which case it gets `role="img"` and a `<title>`. It has no client code, so it's usable from server components.

### 2. `lib/hosty-voice.ts` (new, pure, no React)

```ts
export type ChatSpeaker = "hosty" | "you" | "note";
export type ChatMessage = {
  id: string;
  speaker: ChatSpeaker;
  text: string;
  action?: { label: string; href: string };
  createdAt: string;
};
export function toChatMessage(row: FeedRow): ChatMessage;
export function briefingIntro(briefing: Briefing, firstName: string | null): string;
```

**Speaker** comes from `row.actor`: `agent` → `hosty`, `host` → `you`, `system` → `note`.

**Phrasing table.** Only strings and numbers already in the row are reused. `" · "`-joined bodies become a natural list ("A, B and C").

| kind (actor) | Saved today | Hosty says |
|---|---|---|
| `run_started` (agent) | "The agent is working on this" | "On it. Let me take a look." |
| `run_started` (host) | "You asked the agent to take another look" | you: "Asked Hosty to take another look" |
| `plan_drafted` | "Plan drafted" / "13 tasks · 4 budget categories · from the template" | "I drafted your plan: 13 tasks and 4 budget categories." (the "from the template"/"written for this event" part becomes a second sentence: "I used the standard template for now." / "I wrote it for this event.") |
| `venues_attached` | "3 venues lined up" / "A · B · C" | "I lined up 3 venues: A, B and C. Nothing's been sent." |
| `venue_search_empty` | "No venues turned up nearby" | "I couldn't find venues nearby yet." |
| `inquiries_drafted` (n>0) | "2 vendor inquiries drafted" / "Catering · AV" | "I drafted 2 vendor inquiries: catering and AV. They're waiting for you to send." |
| `inquiries_drafted` (none) | "No vendors to draft for" | "I couldn't find vendors in the catalog that fit this date yet." |
| `step_skipped` | e.g. "Didn't look for venues" / "you already have a venue" | "I didn't look for venues. You already have a venue." (the saved reason as a capitalised sentence in Hosty's own words: "Hosty doesn't…" → "I don't…"; the out-of-time note becomes "I ran out of time before getting to it." with no promise to pick it up) |
| `step_failed` | e.g. "Couldn't find venues" / note | "I couldn't find venues this time." (no retry promise: the sweep stops after its max attempts) |
| `run_finished` | "The agent finished" / "…with problems", body "Done: plan, venues · Left undone: vendors"; or a trigger outcome line | "All done for now. I finished the plan and venues." / "I finished the plan and venues, but couldn't finish vendor inquiries." / "Some of it didn't work this time." (no detail) / outcome lines in first person ("I'm already on it.") |
| `event_created` (system) | "Event created" | note: "Event created" |
| `brief_saved` (host) | "Brief updated" / "Title · Date · City" | you: "Updated the brief: title, date and city" |
| `task_done` (host) | "Done: X" | you: "Done: X" (unchanged) |
| `venue_attached` (host) | "Added X as a venue option" | you: unchanged |
| `collaborator_confirmed`, `collaborator_sent`, `inquiry_sent`, `inquiry_booked`, `inquiry_declined`, `published`, `unpublished` (host) | e.g. "Emailed X" | you: the saved title, unchanged |
| `guest_rsvp`, `guest_checked_in`, `registration_request` (system) | e.g. "Ada is going" | note: the saved title |
| **anything else** | — | saved title (+ body), spoken by the row's actor |

`action` = `{ label, href }` when `row.href` is set. The label depends on the kind ("Open the plan", "See the venues", "Review the drafts"), with "Open" as the default.

**`briefingIntro`:**
- No items: "All quiet. Nothing needs you today."
- Nothing urgent, N soon: "Hi Leo, nothing's urgent. N things are coming up:"
- 1 now (+ M soon): "Hi Leo, one thing needs you today" + (M > 0 ? " and M are coming up:" : ":")
- K now: "Hi Leo, K things need you today:"
- No first name: "Hi," in place of "Hi Leo,"

### 3. Thread: `components/activity-feed.tsx` + `components/chat-thread.tsx` (new)
- `ActivityFeed` keeps its polling, backoff, pause/resume and visibility logic **unchanged**. Only its render output changes: it maps rows through `toChatMessage` and hands them to `ChatThread`.
- `ChatThread({ messages, agentStatus, now, eventId })` is presentational:
  - Oldest to newest (the display order reverses the stored newest-first order).
  - **Hosty** messages sit on the left, with the avatar and "Hosty · time" once per consecutive group, in neutral bubbles. **You** messages sit on the right in brand-blue bubbles, with "You · time" under them. **Notes** are centered grey text with the time.
  - `action` renders as a small pill link inside the bubble.
  - A typing indicator (Hosty avatar + three dots) shows while `agentStatus === "running"`.
  - The empty state is Hosty saying "Fill in the brief and I'll get going.", with a "Open the brief" action.
  - Scrolling: a max height (about 28rem) with internal scroll. It starts at the bottom, and after a poll it sticks to the bottom only when the reader was already within about 80px of it.
  - Accessibility: `aria-live="polite"` stays on the list. Each message has a visually hidden speaker prefix ("Hosty:", "You:"), and the avatar is `aria-hidden`.
- The heading "What's happening" and its live dot / "Paused — resume" control stay.

### 4. Side panel: `components/agent-panel.tsx` + `components/agent-card.tsx`
- Header: `HostyMark` + "Hosty" + the existing `briefing.headline` in muted text.
- Body: one bubble with `briefingIntro(briefing, firstName)`, then each `BriefingItem` as a compact row: the title, a due line colored by urgency (amber for now, muted for soon), and the **existing** `AgentCardAction` on the right. The switch is reused as-is, so it stays exhaustive and every row keeps exactly one action.
- The `detail` text moves to a `title` tooltip on the row. It keeps the rows short; it's the same information.
- New prop `firstName: string | null`, passed from `app/(workspace)/events/[id]/layout.tsx` (which already loads the user).

### 5. Sidebar status: `components/workspace-sidebar.tsx`
The dot becomes `HostyMark size={20}`. Text:
- Running: "Hosty is working on this…" (the mark gets the existing `animate-pulse`)
- Queued: "Hosty will start soon"
- Needs brief: "Hosty needs {describeMissing(...)}"
- Failed: "Hosty's last run didn't finish"
- Idle: "Hosty is resting · ran 1m ago"

The existing buttons stay.

### 6. Workspace copy
User-facing "the agent" becomes "Hosty" only on the surfaces above and the Brief tab's "What the agent still needs" box. Nothing else is renamed.

### 7. Landing: `components/landing.tsx`, `components/landing-preview.tsx`
- **Hero pill:** `HostyMark size={16}` replaces the `bg-brand` dot. The text becomes "Meet Hosty, an agent for the whole event".
- **Preview panel, right column:** a header row with `HostyMark` + "Hosty". "Drafting…" becomes "Hosty is typing…" (same dot animation). "It hands back" becomes an opening line, "Here's your plan for Thursday's mixer:", above the existing tasks and budget chips. The server still renders the finished panel, and reduced motion still skips the animation.

## Data flow

There are no schema, API or server-action changes. `GET /api/v1/events/[id]/activity` returns the same `FeedRow`s. `toChatMessage` is pure and runs on both the server render and the client polls, so the markup matches across hydration. `briefingFor` is unchanged; the panel only adds `briefingIntro`.

## Error handling and edge cases
- An unknown or new `kind` falls back to the saved title/body with the actor as speaker, so rows can't vanish.
- Grounding: Hosty's sentences contain no number that isn't in the row (tested with `numbersAreGrounded`).
- A missing first name drops it from the greeting.
- An empty thread or empty panel shows the Hosty lines above.
- A long thread scrolls internally and never jumps while the reader is scrolled up.

## Testing
Vitest render tests with `renderToStaticMarkup` (the repo convention, e.g. `tests/unit/landing-motion.test.ts`). **No source-grep tests.**
- `tests/unit/hosty-voice.test.ts`: a table test over every kind in the phrasing table (speaker, text, action); the unknown-kind fallback; `numbersAreGrounded` on every Hosty sentence; the `briefingIntro` cases.
- `tests/unit/chat-thread.test.ts`: order, grouping, you/note placement, action pill, typing indicator only while running, empty state, speaker prefixes.
- `tests/unit/agent-panel.test.ts`: greeting, rows keep their action buttons, the "All quiet" state.
- Update `tests/unit/landing-motion.test.ts` (pill text, "Hosty" header, still server-rendered finished, still pill-first order) and `tests/unit/activity-format.test.ts` where labels or order change.
- Manual: the Overview, a stage page's side panel, the sidebar status and the landing page in Chrome, at desktop and 390px widths.

## Housekeeping
Add `.superpowers/` to `.gitignore`.
