# Hosty

**An AI agent for people who run the same event again and again.**

Brief Hosty once and he drafts the plan, lines up venues, writes to vendors,
tracks who's coming and hands you a run sheet for the day. You approve. He
does the rest. The second, fifth and twentieth night should take a fraction
of the first.

Live at [tryhosty.app](https://tryhosty.app). Invite-only while we're small.

## Who it's for

**Recurring hosts**: the person behind a monthly pitch night, a weekly run
club social or a termly alumni dinner. Every product decision is judged by
one question: *does this make the next night faster than the last one?*

Hosty is **B2B and host-side only**. Guests never need an account to be
invited, vendors and venues never log in, and there is no consumer
marketplace. One-off hosts can use Hosty, but nothing is built for them
specifically. The full product scope is locked in
[`docs/superpowers/specs/2026-09-22-scope-lock-recurring-hosts.md`](docs/superpowers/specs/2026-09-22-scope-lock-recurring-hosts.md).

## Meet Hosty

Hosty is the agent, and he talks to you like a colleague, not a to-do list.

- **On the Overview**, what he's done reads as a chat: *"I drafted your plan:
  13 tasks and 4 budget categories."* · *"I lined up 3 venues: Back Bay
  Events Center, Somerville Studios and Southie Event Spaces. Nothing's been
  sent."* Your own actions appear as your replies, and he shows a typing
  indicator while he works.
- **Beside every page**, he greets you with what needs you: *"Hi Leo, one
  thing needs you today and 4 are coming up:"* followed by each item and its
  one button.
- **He runs himself.** Saving a complete brief starts a run. So does the
  "Run again" button, and a daily sweep at 13:30 UTC. Each run drafts the
  plan, finds venues and drafts vendor inquiries.

Three rules hold everywhere:

1. **Hosty drafts; a human presses every send, publish and spend button.**
   He never emails a vendor, publishes an event or commits money on his own.
2. **He only says what's true.** Every sentence he speaks is phrased from
   what was actually saved (`lib/hosty-voice.ts`), and a number that isn't in
   the record never appears in his words.
3. **He works without a model, and better with one.** With
   `ANTHROPIC_API_KEY` set he uses Claude (`claude-sonnet-5` by default,
   `AI_MODEL` to override) to write the plan and pick venues. Without it, or
   if a call fails or times out, he falls back to Hosty's own planning
   templates, so a run always finishes.

## What a host does with it

**Brief**: the kind of event, the date, the city, the headcount and the
budget. That's all Hosty needs to start.

**The workspace** (`/events/:id`) has six tabs:

| Tab | What's there |
| --- | --- |
| **Overview** | Headcount at a glance, Hosty's chat thread, what's next |
| **Brief** | The five essentials plus the vibe and a venue if you already have one |
| **Planning** | The timeline counted back from the date, the budget split, the run sheet |
| **Venue** | Venues near you, priced against this event |
| **Outreach** | Venues, vendors, speakers and cohosts, each with a drafted first message; confirm, send or remove |
| **Guests** | The guest list, the guest book, blasts, promotion and door check-in |

Hosty prices every option against *your* event. A directory says a venue is
"$640/hour". Hosty says it's **"$5,120 for your 8 hours, 33% of your venue
budget, and comfortable for 90 guests."** Booking a vendor writes into the
budget and ticks off the matching task, and RSVPs feed back into the
headcount everything is priced against.

**For the next night:**

- **Run it again** (owner only) copies the brief, budget split, tasks, vendors
  and run sheet into a new draft on a new date. Guests aren't copied
  (`lib/run-again.ts`).
- **Series** groups repeat nights; `/series/:id` lists every night and who
  came.
- **Guest book** (`lib/guest-book.ts`): everyone who came to your events,
  ready to invite again in one click.
- **Vendor book** (`lib/vendor-book.ts`): every venue, speaker, cohost and
  catalog vendor you've confirmed or booked, ready to add to the next event.

## Access

Hosty is invite-only. People join the waitlist on the landing page. The
administrator (`ADMIN_EMAIL` in `lib/access.ts`) lets them in from
`/admin/waitlist`, and each one gets an email with a link to set a password.
The administrator also sees `/admin/events`, every host's events, and can
remove any of them.

## Connect an agent

Hosty speaks MCP, so Claude, ChatGPT and Cursor can read your events.
`POST /api/mcp` accepts two credentials:

- **OAuth**, for Claude and ChatGPT custom connectors. Consent, refresh and
  disconnect live under Settings → AI connections. Tools: `list_events`,
  `get_event_brief`, `search_venues`.
- **Bearer token**, for Cursor and anything else that can send
  `Authorization: Bearer`. Get one from the Connect an agent page (`/mcp`) or
  `POST /api/v1/auth/token`. Tools: `list_events`, `get_event`,
  `list_guests`.

An OAuth token is checked first; anything that isn't a live grant falls
through to the bearer token. See [docs/mcp.md](docs/mcp.md).

## Running it

Requires Node 20.19+ and PostgreSQL 16.

```bash
npm install

createdb hosty              # any Postgres will do
cp .env.example .env        # then set DATABASE_URL and AUTH_SECRET
npm run db:migrate          # apply migrations
npm run db:seed             # the catalog, demo events and demo accounts

npm run dev                 # http://localhost:3000
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

Open the dev server as `localhost`, `127.0.0.1` or your machine's Wi-Fi
address from a phone (`192.168.x.x:3000`). `localhost` works because it's
the host `next dev` starts on; `127.0.0.1`, `*.local` and private-network
addresses (`192.168.*.*`, `10.*.*.*`, `172.*.*.*`) are listed in
`allowedDevOrigins` in `next.config.ts`. `next dev` refuses to serve its
scripts to any other hostname.

**Demo login, local and CI only:** `maya@hosty.demo` / `hosty-demo`.
The repo is public, so hosted builds never use that password
(`lib/demo-login.ts`). Preview and production share one database, so there
a demo account gets `DEMO_PASSWORD` if it's set and an unknowable random
password otherwise.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build and serve |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end spine test (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database. `db:migrate` and `db:reset` refuse a non-local `DATABASE_URL` |
| `npm run db:studio` | Prisma Studio |
| `npm run relink:guest-book` | One-off: links guests added since the recurring-hosts backfill to their host's guest book. Idempotent |
| `npm run vercel-build` | What Vercel runs: generate, migrate, seed, then `next build` |

## Deploying to Vercel

Use **one** Vercel project for this repo. Connect **Prisma Postgres** or
**Neon** under Storage (that injects `DATABASE_URL`), then set these for
Production and Preview:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | From Storage, if it wasn't added automatically |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `DIRECT_URL` | Optional. The non-pooled URL, used by `prisma migrate` |
| `HOSTY_ADMIN_PASSWORD` | Optional. The seed creates or rotates the administrator from it on every deploy |
| `DEMO_PASSWORD` | Optional, 8+ characters. Applied to the demo accounts on every deploy; without it they get a random password |
| `CRON_SECRET` | Protects the scheduled routes below; Vercel sends it as a bearer token |

`vercel-build` generates Prisma Client, applies migrations, seeds the catalog
if it's empty, and runs `next build`. **Preview builds run against the
production database too**, so a migration or seed change takes effect the
moment a preview builds.

**Scheduled jobs** (`vercel.json`): `agent-briefing` (13:00 UTC) sends each
host their "needs you today" digest; `agent-run` (13:30 UTC) picks up runs
that never finished and events that never started one; `close-events` (09:00
UTC) marks finished events completed and freezes their outcome;
`campus-sync` (10:00 UTC) refreshes school calendars, which feed the Guests
tab's "what else is on that night" advice.

### Optional services

| Variable | Turns on |
| --- | --- |
| `ANTHROPIC_API_KEY` (`AI_MODEL` optional) | Model-written plans and venue picks. Without it Hosty uses his templates |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email from any mailbox (Gmail app password, Fastmail…), no DNS needed |
| `RESEND_API_KEY`, `RESEND_FROM` | Email through Resend with a verified domain. Wins over SMTP when both are set |
| `GOOGLE_MAPS_API_KEY` | Venue search (Google Places API (New)) |
| `APPLE_MAPS_TEAM_ID`, `APPLE_MAPS_KEY_ID`, `APPLE_MAPS_PRIVATE_KEY` | Fallback venue search (Apple Maps Server API), used only without the Google key |
| `BLOB_READ_WRITE_TOKEN` | Photo uploads in Vercel Blob; without it photos live in Postgres |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Phone verification texts and SMS blasts |
| `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_ENV` | Push notifications to the iOS app |

Email covers waitlist invites, password resets, blasts and vendor outreach.
Without a transport, production refuses to pretend an email went out.
The target design is [docs/email-system-plan.md](docs/email-system-plan.md).
`docs/backend.md` maps the whole backend: data, images, accounts, and which
keys turn on what.

## How it's put together

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 → Postgres ·
Auth.js v5 · Vitest · Playwright.

The interesting logic is pure and unit-tested, kept out of components so the
cases that matter are reachable from a test:

| Module | Responsibility |
| --- | --- |
| `lib/agent/*` | Hosty's run: the plan, venue and vendor steps, triggers, the sweep, the daily briefing |
| `lib/hosty-voice.ts` | How Hosty phrases what happened, grounded in the saved record |
| `lib/ai/*` | The model client and its schema-checked answers, with template fallbacks |
| `lib/scoring.ts` | Prices and scores one listing against one event |
| `lib/plan.ts`, `lib/templates.ts` | The budget and timeline for an event type |
| `lib/run-again.ts`, `lib/guest-book.ts`, `lib/vendor-book.ts` | The recurring-host features |
| `lib/budget.ts`, `lib/guests.ts`, `lib/runsheet.ts` | Budget roll-up, RSVP maths, the day-of schedule |
| `lib/money.ts` | Integer-cent arithmetic and formatting |

Decisions worth knowing:

- **Shared writers never live in `"use server"` modules.** Every export of
  one is a public endpoint; the agent and the host's own buttons share
  writers in plain modules (`lib/inquiries.ts`, `lib/replan-apply.ts`).
- **Money is integer cents, everywhere.** `allocateCents` splits a budget
  across weights without losing or inventing a cent.
- **Timeline positions are fractions of a planning horizon**, so an event
  booked six weeks out compresses the template into the 42 days that exist
  instead of emitting overdue tasks.
- **The planning headcount only moves for a real signal**, a regret or a
  guest list that outgrows the estimate, so typing a fourth guest's name
  doesn't reprice the venue for four people.
- **Inquiry drafts never mention your budget.** Telling a vendor what you
  have to spend is how it becomes what you spend.
- **Hosty's activity is stored once and phrased when shown.** The feed saves
  plain rows (`lib/activity.ts`), and the chat voice is applied at render
  time, so old history reads in his voice too and a new kind of row can
  never disappear.

## The iOS app and the consumer side

`ios/` is a native SwiftUI app (iOS 26) on the same backend, with a JSON API
under `/api/v1`. It predates the B2B focus and still carries the consumer
features: discovering events, student and campus calendars, and clubs. It is
**frozen**: bug fixes only. See [`ios/README.md`](ios/README.md).

On the web, those consumer pages are gone: `/discover`, `/campus`, `/c/…` and
`/clubs` redirect home. The full pre-B2B app, including all of them, is kept
on the **`discover` branch**. The data and the iOS API routes stay on `main`.

## Known limits

- **The catalog is invented.** The seeded venues and vendors are plausible
  fiction chosen to exercise the pricing logic, not real businesses.
- **No payments.** The budget tracks money (committed, paid, outstanding);
  it doesn't move it. Ticket prices are shown, and hosts collect them.
- **Two web themes.** Public pages are light warm monochrome; the signed-in
  app is blue. `app/globals.css` is the source of truth.
- `npm audit` reports advisories inside the Prisma CLI's build-time
  dependencies (`mysql2`, `deepmerge-ts`). They reach neither the server
  runtime nor the browser.

## Tests

Unit tests cover the pure logic and the boundaries that bite: pricing
exactly at capacity, a budget that doesn't divide evenly, an event whose date
has passed, and every kind of line Hosty can say.

`tests/e2e/spine.spec.ts` is one deliberately long Playwright test that walks
the whole host journey, from sign-in to brief, plan, discovery, a drafted
inquiry, booking and the budget write-back. The product's claim is that these
steps are connected, and only walking the connection tests that.

```bash
npm test          # unit
npm run test:e2e  # end to end (starts a dev server if one isn't running)
```
