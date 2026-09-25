# More Event Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eight event types (networking night, workshop, speaker event, hackathon, game night, watch party, showcase, run club) that plan, schedule, search and classify as well as the ten Hosty has.

**Architecture:** One additive Postgres enum migration, then one entry per new type in every per-type table: labels and picker order (`lib/catalog.ts`), templates (`lib/templates.ts`), run sheets (`lib/runsheet.ts`), venue search terms (`lib/venues/query.ts`, `lib/venues/rank.ts`), icons (`lib/event-icon.ts`) and the brief's keyword table (`lib/brief.ts`). The exhaustive `Record<EventType, …>` tables make `npm run typecheck` fail until each is filled; tests pin the two non-exhaustive tables.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7 (Postgres), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-venue-scouting-and-event-types-design.md` (Part A)

## Global Constraints

- New enum values, exactly: `NETWORKING`, `WORKSHOP`, `SPEAKER_EVENT`, `HACKATHON`, `GAME_NIGHT`, `WATCH_PARTY`, `SHOWCASE`, `RUN_CLUB`.
- Labels, exactly: "Networking night", "Workshop", "Speaker event", "Hackathon", "Game night", "Watch party", "Showcase", "Run club".
- No weddings or family occasions (schema comment on `EventType`).
- iOS is frozen: no change under `ios/`. Its `EventKind` decodes unknown values as `.unknown`.
- Tests render or call functions; never read a source file and regex it (the no-mistakes review rejects that).
- Every template's budget weights sum to exactly 1, every `required` category is funded, every task `at` is within 0–1, and at least three categories are funded unless the type is added to `ALLOWED_SMALL_BUDGET` in `tests/unit/plan.test.ts` on purpose. None of the new types needs that exception.
- `durationHours` is capped at 24 (`lib/duration.ts`), so a hackathon's run sheet must end by minute 1440.
- Preview builds run `prisma migrate deploy` against the production database. The migration only adds enum values, which is safe to apply before merge.

## Review Focus

1. **Brief keyword collisions.** "game night", "trivia night", "open mic night" and "networking mixer" must resolve to `GAME_NIGHT`, `GAME_NIGHT`, `SHOWCASE` and `NETWORKING`, not to `MIXER`, whose "night" catches everything. "workshop" and "panel" must move off `GENERAL_MEETING`, and "GBM" must stay there. Pinned in Task 4.
2. **Substring false positives in the keyword table.** `eventTypeForKind` matches substrings, so "run" would catch "brunch" and "ama" would catch "drama". Brunch must stay a dinner party. Pinned in Task 4.
3. **A 24-hour hackathon run sheet** must stay ordered, end with clear-down, and fit inside the day. Pinned in Task 3.
4. **The picker keeps `MIXER` first** and gains `NETWORKING` second, so an old habit still finds its type. Pinned in Task 1.
5. **Icons for the new types.** `BY_EVENT_TYPE` is typed `Record<string, …>`, so a missing entry would silently fall back to guessing from the title. Pinned in Task 5.

---

### Task 1: Enum values, labels and picker order

**Files:**
- Create: `prisma/migrations/20260925120000_more_event_types/migration.sql`
- Modify: `prisma/schema.prisma:263-276` (enum `EventType`)
- Modify: `lib/catalog.ts:42-74` (`EVENT_TYPE_LABEL`, `EVENT_TYPE_ORDER`)
- Test: `tests/unit/catalog.test.ts`

**Interfaces:**
- Produces: `EventType` gains the eight values; `EVENT_TYPE_LABEL[t]` for each; `EVENT_TYPE_OPTIONS[1].value === "NETWORKING"`.

- [ ] **Step 1: Write the failing test**

Add to the `describe("the event type picker", …)` block in `tests/unit/catalog.test.ts`:

```ts
  it("puts networking night right after the mixer", () => {
    expect(EVENT_TYPE_OPTIONS.slice(0, 2).map((o) => o.value)).toEqual(["MIXER", "NETWORKING"]);
  });

  it("offers the recurring-host types added in September 2026", () => {
    const labels = Object.fromEntries(EVENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));
    expect(labels).toMatchObject({
      NETWORKING: "Networking night",
      WORKSHOP: "Workshop",
      SPEAKER_EVENT: "Speaker event",
      HACKATHON: "Hackathon",
      GAME_NIGHT: "Game night",
      WATCH_PARTY: "Watch party",
      SHOWCASE: "Showcase",
      RUN_CLUB: "Run club",
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: FAIL. The second option is `GENERAL_MEETING`, and `labels` has no `NETWORKING` key.

- [ ] **Step 3: Write the migration**

`prisma/migrations/20260925120000_more_event_types/migration.sql`:

```sql
-- Eight nights recurring hosts run that the ten types couldn't describe:
-- a networking night was filed as a mixer, a workshop as a general meeting.
-- Sources: Eventbrite's event formats and the event types student
-- organisations run most (docs/superpowers/specs/2026-09-25-venue-scouting-and-event-types-design.md).

-- AlterEnum
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- isn't used within that same transaction, which none of these are.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'NETWORKING';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'WORKSHOP';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SPEAKER_EVENT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'HACKATHON';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'GAME_NIGHT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'WATCH_PARTY';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SHOWCASE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'RUN_CLUB';
```

- [ ] **Step 4: Add the values to the schema**

In `prisma/schema.prisma`, the enum becomes:

```prisma
/// Hosty is for student, professional and fun events — no weddings or
/// family occasions.
enum EventType {
  BIRTHDAY
  CORPORATE_OFFSITE
  LAUNCH_PARTY
  DINNER_PARTY
  FUNDRAISER
  MIXER
  GENERAL_MEETING
  FORMAL
  PITCH_NIGHT
  STUDY_BREAK
  NETWORKING
  WORKSHOP
  SPEAKER_EVENT
  HACKATHON
  GAME_NIGHT
  WATCH_PARTY
  SHOWCASE
  RUN_CLUB
}
```

Run: `npx prisma generate`
Expected: "Generated Prisma Client". `generated/` is gitignored, so there's nothing to commit from it.

- [ ] **Step 5: Add the labels and the picker order**

In `lib/catalog.ts`, add to `EVENT_TYPE_LABEL` after `STUDY_BREAK: "Study break",`:

```ts
  NETWORKING: "Networking night",
  WORKSHOP: "Workshop",
  SPEAKER_EVENT: "Speaker event",
  HACKATHON: "Hackathon",
  GAME_NIGHT: "Game night",
  WATCH_PARTY: "Watch party",
  SHOWCASE: "Showcase",
  RUN_CLUB: "Run club",
```

and replace `EVENT_TYPE_ORDER` with:

```ts
const EVENT_TYPE_ORDER: EventType[] = [
  "MIXER",
  "NETWORKING",
  "GENERAL_MEETING",
  "WORKSHOP",
  "SPEAKER_EVENT",
  "STUDY_BREAK",
  "PITCH_NIGHT",
  "GAME_NIGHT",
  "FORMAL",
  "DINNER_PARTY",
];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Apply the migration locally**

Run: `npx prisma migrate deploy`
Expected: "Applying migration `20260925120000_more_event_types`". The local `.env` points at Postgres on 127.0.0.1. If it reports unrelated drift, note it and carry on: the unit tests don't touch the database.

- [ ] **Step 8: Commit**

`npm run typecheck` fails from here until Task 3 fills the other `Record<EventType, …>` tables. That is expected; the commit is still self-contained.

```bash
git add prisma/migrations/20260925120000_more_event_types/migration.sql prisma/schema.prisma lib/catalog.ts tests/unit/catalog.test.ts
git commit -m "Add eight event types: networking night, workshop, speaker event, hackathon, game night, watch party, showcase, run club"
```

### Task 2: Planning templates

**Files:**
- Modify: `lib/templates.ts:118-333` (`EVENT_TEMPLATES`)
- Test: `tests/unit/plan.test.ts`

**Interfaces:**
- Consumes: the `EventType` values from Task 1.
- Produces: `EVENT_TEMPLATES[t]` for each new type. `lib/brief-classify.ts` reads each `blurb` into Jev's choice, and `lib/ai/plan-draft.ts` reads the keys.

- [ ] **Step 1: Write the failing test**

Add to the first `describe` block in `tests/unit/plan.test.ts` (the one holding "covers every event type in the schema"):

```ts
  it("templates the recurring-host types with the shapes they need", () => {
    expect(EVENT_TEMPLATES.HACKATHON.defaultDurationHours).toBe(24);
    expect(EVENT_TEMPLATES.SPEAKER_EVENT.required).toEqual(["VENUE", "AV_PRODUCTION"]);
    expect(EVENT_TEMPLATES.RUN_CLUB.horizonDays).toBeLessThanOrEqual(7);
    for (const type of ["NETWORKING", "WORKSHOP", "GAME_NIGHT", "WATCH_PARTY", "SHOWCASE"] as const) {
      expect(EVENT_TEMPLATES[type].required, type).toContain("VENUE");
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/plan.test.ts`
Expected: FAIL. "covers every event type in the schema" reports `missing template: NETWORKING`, and the new test throws reading `defaultDurationHours` of undefined.

- [ ] **Step 3: Add the templates**

In `lib/templates.ts`, after the `STUDY_BREAK` entry and before the closing `};` of `EVENT_TEMPLATES`:

```ts

  NETWORKING: {
    type: "NETWORKING",
    blurb: "A room you can hear each other in, name tags, and a drink.",
    horizonDays: 21,
    defaultDurationHours: 2,
    defaultGuestCount: 50,
    budget: [
      { category: "VENUE", weight: 0.4 },
      { category: "CATERING", weight: 0.3 },
      { category: "BAR_SERVICE", weight: 0.2 },
      { category: "PHOTOGRAPHY", weight: 0.1 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Confirm who's coming from each company", at: 0.5 },
      { title: "Print the name tags", at: 0.1 },
    ],
  },

  WORKSHOP: {
    type: "WORKSHOP",
    blurb: "Tables, a screen, and everyone leaves able to do one new thing.",
    horizonDays: 21,
    defaultDurationHours: 2,
    defaultGuestCount: 30,
    budget: [
      { category: "VENUE", weight: 0.4 },
      { category: "CATERING", weight: 0.3 },
      { category: "AV_PRODUCTION", weight: 0.2 },
      { category: "RENTALS", weight: 0.1 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Confirm the instructor and what they need", at: 0.8 },
      { title: "Tell everyone what to bring", at: 0.15 },
    ],
  },

  SPEAKER_EVENT: {
    type: "SPEAKER_EVENT",
    blurb: "A talk, a panel or a fireside chat: a stage, good mics, questions from the floor.",
    horizonDays: 30,
    defaultDurationHours: 2,
    defaultGuestCount: 80,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "AV_PRODUCTION", weight: 0.3 },
      { category: "CATERING", weight: 0.25 },
      { category: "PHOTOGRAPHY", weight: 0.1 },
    ],
    required: ["VENUE", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Confirm the speakers and their bios", at: 0.8 },
      { title: "Collect questions for the moderator", at: 0.2 },
      { title: "Mic check with the speakers", at: 0.03, category: "AV_PRODUCTION" },
    ],
  },

  HACKATHON: {
    type: "HACKATHON",
    blurb: "Twenty-four hours, power strips, wifi that holds, and food at 2am.",
    horizonDays: 45,
    defaultDurationHours: 24,
    defaultGuestCount: 100,
    budget: [
      { category: "VENUE", weight: 0.3 },
      { category: "CATERING", weight: 0.45 },
      { category: "RENTALS", weight: 0.15 },
      { category: "AV_PRODUCTION", weight: 0.1 },
    ],
    required: ["VENUE", "CATERING"],
    extraTasks: [
      { title: "Confirm the sponsors and the prizes", at: 0.75 },
      { title: "Confirm the judges", at: 0.5 },
      { title: "Test the wifi with the venue", at: 0.1, category: "VENUE" },
    ],
  },

  GAME_NIGHT: {
    type: "GAME_NIGHT",
    blurb: "Trivia or board games: tables, a host with a mic, and a prize worth winning.",
    horizonDays: 14,
    defaultDurationHours: 3,
    defaultGuestCount: 40,
    budget: [
      { category: "VENUE", weight: 0.4 },
      { category: "CATERING", weight: 0.35 },
      { category: "AV_PRODUCTION", weight: 0.15 },
      { category: "RENTALS", weight: 0.1 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Write the questions or pick the games", at: 0.5 },
      { title: "Buy the prizes", at: 0.2 },
    ],
  },

  WATCH_PARTY: {
    type: "WATCH_PARTY",
    blurb: "A match or a film on a big screen, sound that carries, and snacks.",
    horizonDays: 10,
    defaultDurationHours: 3,
    defaultGuestCount: 50,
    budget: [
      { category: "VENUE", weight: 0.4 },
      { category: "AV_PRODUCTION", weight: 0.3 },
      { category: "CATERING", weight: 0.3 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Confirm the screen and the sound with the venue", at: 0.5, category: "VENUE" },
      { title: "Test the stream", at: 0.03, category: "AV_PRODUCTION" },
    ],
  },

  SHOWCASE: {
    type: "SHOWCASE",
    blurb: "An open mic, a talent show or a performance: a stage, a sign-up sheet, a crowd that claps.",
    horizonDays: 30,
    defaultDurationHours: 3,
    defaultGuestCount: 80,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "AV_PRODUCTION", weight: 0.3 },
      { category: "CATERING", weight: 0.2 },
      { category: "PHOTOGRAPHY", weight: 0.15 },
    ],
    required: ["VENUE", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Open performer sign-ups", at: 0.7 },
      { title: "Set the running order", at: 0.15 },
      { title: "Sound check with the performers", at: 0.03, category: "AV_PRODUCTION" },
    ],
  },

  RUN_CLUB: {
    type: "RUN_CLUB",
    blurb: "A meeting point, a route, and coffee after.",
    horizonDays: 7,
    defaultDurationHours: 2,
    defaultGuestCount: 30,
    budget: [
      { category: "CATERING", weight: 0.5 },
      { category: "VENUE", weight: 0.3 },
      { category: "PHOTOGRAPHY", weight: 0.2 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Map the route and share it", at: 0.4 },
      { title: "Check the weather", at: 0.03 },
    ],
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/plan.test.ts`
Expected: PASS, including "has budget weights summing to exactly 1", "allocates budget to every category it marks required" and "keeps task positions inside the horizon".

- [ ] **Step 5: Commit**

```bash
git add lib/templates.ts tests/unit/plan.test.ts
git commit -m "Template the eight new event types"
```

### Task 3: Run sheets and venue search terms

These are together because they finish the exhaustive tables, which turns `npm run typecheck` green again.

**Files:**
- Modify: `lib/runsheet.ts:26-39` (`DEFAULT_START_HOUR`) and `lib/runsheet.ts:73-138` (`RUNNING_ORDER`)
- Modify: `lib/venues/query.ts:10-21` (`BASE_QUERY`)
- Modify: `lib/venues/rank.ts:39-50` (`CATEGORY_KEYWORD`)
- Test: `tests/unit/runsheet.test.ts`, `tests/unit/venue-query.test.ts`

**Interfaces:**
- Consumes: the `EventType` values from Task 1.
- Produces: `defaultStartHour(t)`, `suggestRunSheet({ type: t, … })` and `venueQueryFor({ type: t, … })` for each new type. Plan B's `scoutVenues` calls `venueQueryFor`.

- [ ] **Step 1: Write the failing tests**

Add to `describe("suggestRunSheet", …)` in `tests/unit/runsheet.test.ts`:

```ts
  it("fits a 24-hour hackathon inside the day, ending with clear-down", () => {
    const sheet = suggestRunSheet({ type: "HACKATHON", durationHours: 24 }, []);
    const offsets = sheet.map((item) => item.offsetMinutes);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(Math.max(...offsets)).toBeLessThanOrEqual(24 * 60);
    expect(sheet[sheet.length - 1].title).toBe("Clear down and vendor collection");
    expect(sheet.some((item) => item.title === "Hacking starts")).toBe(true);
  });

  it("starts a run club in the morning", () => {
    expect(arrivalClock(new Date("2026-10-03T12:00:00"), "RUN_CLUB")).toEqual({ hour: 8, minute: 0 });
  });
```

Add to `describe("venueQueryFor", …)` in `tests/unit/venue-query.test.ts`:

```ts
  it("searches for a lounge, not a bar, for a networking night", () => {
    expect(venueQueryFor({ type: "NETWORKING", guestCount: 50 })).toBe("cocktail lounge");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/runsheet.test.ts tests/unit/venue-query.test.ts`
Expected: FAIL. The hackathon sheet has no "Hacking starts" item, the run club's start hour is undefined, and the networking query is `"undefined"`.

- [ ] **Step 3: Add start hours and running orders**

In `lib/runsheet.ts`, add to `DEFAULT_START_HOUR` after `STUDY_BREAK: 20,`:

```ts
  NETWORKING: 18,
  WORKSHOP: 18,
  SPEAKER_EVENT: 18,
  HACKATHON: 9,
  GAME_NIGHT: 19,
  WATCH_PARTY: 19,
  SHOWCASE: 19,
  RUN_CLUB: 8,
```

and to `RUNNING_ORDER` after the `STUDY_BREAK` entry:

```ts
  NETWORKING: [
    [0, "Doors open, name tags on"],
    [20, "Welcome and how tonight works"],
    [30, "Open networking"],
    [105, "Last call"],
    [115, "Wrap up"],
  ],
  WORKSHOP: [
    [0, "Arrivals, settle in at the tables"],
    [15, "Intro and what we'll make"],
    [25, "Hands-on session"],
    [100, "Show and tell"],
    [115, "Wrap up"],
  ],
  SPEAKER_EVENT: [
    [0, "Doors open"],
    [15, "Welcome and introductions"],
    [20, "Talk or panel"],
    [80, "Questions from the floor"],
    [100, "Mingle"],
  ],
  HACKATHON: [
    [0, "Check-in"],
    [60, "Kickoff and team forming"],
    [120, "Hacking starts"],
    [720, "Midnight food"],
    [1260, "Hacking ends, submissions due"],
    [1320, "Demos and judging"],
    [1410, "Winners announced"],
  ],
  GAME_NIGHT: [
    [0, "Doors open, teams form"],
    [20, "Round one"],
    [80, "Break"],
    [95, "Final rounds"],
    [160, "Winners announced"],
  ],
  WATCH_PARTY: [
    [0, "Doors open, food out"],
    [30, "Kickoff or film starts"],
    [90, "Halftime or intermission"],
    [170, "Final whistle or credits"],
  ],
  SHOWCASE: [
    [0, "Doors open"],
    [15, "Host opens the show"],
    [20, "First half"],
    [95, "Intermission"],
    [110, "Second half"],
    [170, "Closing"],
  ],
  RUN_CLUB: [
    [0, "Meet and warm up"],
    [15, "Run starts"],
    [60, "Back at the meeting point"],
    [65, "Coffee and hang out"],
  ],
```

- [ ] **Step 4: Add the venue search terms**

In `lib/venues/query.ts`, add to `BASE_QUERY` after `STUDY_BREAK: "cafe",`:

```ts
  NETWORKING: "cocktail lounge",
  WORKSHOP: "workshop space",
  SPEAKER_EVENT: "auditorium",
  HACKATHON: "event space",
  GAME_NIGHT: "pub trivia night",
  WATCH_PARTY: "sports bar",
  SHOWCASE: "live music venue",
  RUN_CLUB: "coffee shop",
```

In `lib/venues/rank.ts`, add to `CATEGORY_KEYWORD` after `STUDY_BREAK: "cafe",`:

```ts
  NETWORKING: "bar",
  WORKSHOP: "event",
  SPEAKER_EVENT: "event",
  HACKATHON: "event",
  GAME_NIGHT: "bar",
  WATCH_PARTY: "bar",
  SHOWCASE: "music",
  RUN_CLUB: "cafe",
```

- [ ] **Step 5: Run tests and the typecheck**

Run: `npx vitest run tests/unit/runsheet.test.ts tests/unit/venue-query.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0. If `tsc` names another `Record<EventType, …>` this plan missed, add the eight types to it in the same style and name the file in the commit message.

- [ ] **Step 6: Commit**

```bash
git add lib/runsheet.ts lib/venues/query.ts lib/venues/rank.ts tests/unit/runsheet.test.ts tests/unit/venue-query.test.ts
git commit -m "Run sheets and venue search terms for the new event types"
```

### Task 4: The brief's keyword table

**Files:**
- Modify: `lib/brief.ts:80-93` (`KIND_KEYWORDS`)
- Test: `tests/unit/brief.test.ts:184-219`

**Interfaces:**
- Consumes: the `EventType` values from Task 1.
- Produces: `eventTypeForKind(text)` resolves the phrases below.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/brief.test.ts`, extend the first `it.each` table in `describe("eventTypeForKind", …)` with:

```ts
    ["networking night", "NETWORKING"],
    ["Networking mixer", "NETWORKING"],
    ["coffee chat with recruiters", "NETWORKING"],
    ["Python workshop", "WORKSHOP"],
    ["panel on climate tech", "SPEAKER_EVENT"],
    ["fireside chat", "SPEAKER_EVENT"],
    ["guest speaker series", "SPEAKER_EVENT"],
    ["spring hackathon", "HACKATHON"],
    ["game night", "GAME_NIGHT"],
    ["pub trivia night", "GAME_NIGHT"],
    ["World Cup watch party", "WATCH_PARTY"],
    ["movie night screening", "WATCH_PARTY"],
    ["open mic night", "SHOWCASE"],
    ["talent show", "SHOWCASE"],
    ["Saturday run club", "RUN_CLUB"],
    ["sunday brunch", "DINNER_PARTY"],
    ["drama club social", "MIXER"],
```

and add to the `phrase` record in "every EventType is reachable from at least one phrase":

```ts
      NETWORKING: "networking",
      WORKSHOP: "workshop",
      SPEAKER_EVENT: "panel",
      HACKATHON: "hackathon",
      GAME_NIGHT: "trivia",
      WATCH_PARTY: "watch party",
      SHOWCASE: "open mic",
      RUN_CLUB: "run club",
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/brief.test.ts`
Expected: FAIL. "networking night" returns `MIXER`, "Python workshop" returns `GENERAL_MEETING`, and "hackathon" returns null.

- [ ] **Step 3: Replace the keyword table**

In `lib/brief.ts`, replace `KIND_KEYWORDS` with the table below. The specific types come first, and the two catch-alls come last, `GENERAL_MEETING` ("meeting") and then `MIXER` ("night", "party"). "run" is left out because it would catch "brunch", and "ama" because it would catch "drama".

```ts
const KIND_KEYWORDS: Array<[EventType, string[]]> = [
  ["HACKATHON", ["hackathon", "hack night", "buildathon", "datathon", "game jam"]],
  ["PITCH_NIGHT", ["pitch", "demo day", "demo night", "shark tank", "startup competition"]],
  ["WATCH_PARTY", ["watch party", "watch along", "viewing party", "screening", "movie night", "film night", "super bowl", "world cup"]],
  ["GAME_NIGHT", ["game night", "games night", "trivia", "quiz night", "board game", "poker night", "bingo"]],
  ["SHOWCASE", ["open mic", "talent show", "showcase", "recital", "concert", "comedy night", "art show", "exhibition"]],
  ["RUN_CLUB", ["run club", "running club", "fun run", "group run", "5k", "walk club"]],
  ["FORMAL", ["formal", "gala", "black tie", "ball", "prom"]],
  ["FUNDRAISER", ["fundraiser", "benefit", "charity", "philanthropy", "raiser"]],
  ["STUDY_BREAK", ["study break", "finals", "midterm", "de stress", "destress", "study"]],
  ["LAUNCH_PARTY", ["launch", "release party", "debut", "premiere"]],
  ["BIRTHDAY", ["birthday", "bday", "21st", "18th", "turning"]],
  ["CORPORATE_OFFSITE", ["offsite", "off site", "retreat", "all hands", "team building", "conference", "summit"]],
  ["NETWORKING", ["networking", "network", "coffee chat", "career night", "industry night", "recruiting"]],
  ["WORKSHOP", ["workshop", "masterclass", "bootcamp", "hands on", "crash course", "skill session"]],
  ["SPEAKER_EVENT", ["panel", "speaker", "fireside", "keynote", "lecture", "in conversation"]],
  ["GENERAL_MEETING", ["gbm", "general meeting", "general body", "info session", "interest meeting", "orientation", "meeting"]],
  ["DINNER_PARTY", ["dinner", "supper", "banquet", "brunch", "lunch", "potluck", "tasting"]],
  ["MIXER", ["mixer", "social", "happy hour", "meet and greet", "kickback", "party", "night"]],
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/brief.test.ts tests/unit/jev-brief.test.ts tests/unit/save-brief-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/brief.ts tests/unit/brief.test.ts
git commit -m "Recognise the new event types in the brief's words"
```

### Task 5: Icons and the whole-suite check

**Files:**
- Modify: `lib/event-icon.ts:36-48` (`BY_EVENT_TYPE`)
- Test: `tests/unit/event-icon.test.ts`

**Interfaces:**
- Consumes: `ALL_EVENT_TYPES` from `lib/catalog.ts`.
- Produces: `iconFor({ type })` returns a specific icon for every type.

- [ ] **Step 1: Write the failing test**

Add `import { ALL_EVENT_TYPES } from "@/lib/catalog";` to the imports of `tests/unit/event-icon.test.ts`, and add to `describe("Hosty's own events", …)`:

```ts
  it.each(ALL_EVENT_TYPES)("gives %s its own icon, whatever the title says", (type) => {
    expect(iconFor({ type, title: "" })).not.toBe(DEFAULT_ICON);
  });

  it("draws a run club as fitness and a showcase as a stage", () => {
    expect(iconFor({ type: "RUN_CLUB" })).toBe("fitness");
    expect(iconFor({ type: "SHOWCASE" })).toBe("stage");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/event-icon.test.ts`
Expected: FAIL for NETWORKING, WORKSHOP, SPEAKER_EVENT, HACKATHON, GAME_NIGHT, WATCH_PARTY, SHOWCASE and RUN_CLUB.

- [ ] **Step 3: Add the icons**

In `lib/event-icon.ts`, add to `BY_EVENT_TYPE` after `STUDY_BREAK: "study",`:

```ts
  NETWORKING: "career",
  WORKSHOP: "meeting",
  SPEAKER_EVENT: "talk",
  HACKATHON: "career",
  GAME_NIGHT: "celebration",
  WATCH_PARTY: "stage",
  SHOWCASE: "stage",
  RUN_CLUB: "fitness",
```

- [ ] **Step 4: Run the whole suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. If lint reports thousands of errors under `.claude/worktrees/`, group the output by path: those come from stale worktrees, not this change.

- [ ] **Step 5: Commit**

```bash
git add lib/event-icon.ts tests/unit/event-icon.test.ts
git commit -m "Icons for the new event types"
```
