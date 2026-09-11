# HostKit

Plan an event end to end: scout venues and vendors, build the budget and the
timeline, track every booking, collect RSVPs, and print the run sheet.

HostKit is **host-side only**. Venue and vendor owners never log in and never
list anything — the catalog is seeded data, and every user is someone planning
an event. The Airbnb comparison describes the *scouting* experience
(photo-forward browsing, filters, saved shortlists), not a two-sided
marketplace.

## The idea

Because HostKit knows your event — date, headcount, city, budget — it can
price every listing *against that specific event*. A directory tells you a
venue is "$640/hour". HostKit tells you it's **"$5,120 for your 8 hours, 33%
of your venue budget, and comfortable for 90 guests."**

Then it keeps the pieces connected. Marking an inquiry **booked** writes a
committed line into the budget and ticks off the matching timeline task.
Declining takes the money back out. RSVPs feed back into the headcount that
every listing is priced against. That write-back loop is what makes it
end-to-end rather than a pile of separate tools.

## Running it

Requires Node 20.19+ and PostgreSQL 16.

```bash
npm install

# Create the database (any Postgres will do)
createdb hostkit

cp .env.example .env        # then set DATABASE_URL and AUTH_SECRET
npm run db:migrate          # apply migrations
npm run db:seed             # 78 venues and vendors across 3 cities

npm run dev                 # http://localhost:3000
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

You can draft a night before you have an account. Publishing — listing it on
Discover or sharing a live guest link — needs a sign-in. Sign up with any
email and password; there's no email service, so no confirmation step.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build and serve |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end spine test (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database. Seed is a no-op if the catalog already has rows. |
| `npm run db:studio` | Prisma Studio |
| `npm run vercel-build` | What Vercel runs: generate, migrate, seed, then `next build` |

## Deploying to Vercel

Vercel is already the right host (Next.js + serverless). The GitHub integration
will fail the build until the project has a hosted Postgres and the Auth.js
secret — the app is not a static site.

Use **one** Vercel project for this repo. Extra projects on the same GitHub
repo each get their own production deploy and will all fail independently.

1. In that project, open **Storage** and connect **Prisma Postgres** (or Neon).
   That injects `DATABASE_URL`.
2. Add environment variables for **Production** and **Preview**:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | From Storage, if it was not added automatically |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |
   | `DIRECT_URL` | Optional. The provider's direct (non-pooled) URL, used by `prisma migrate` |

3. Redeploy the production branch.

`vercel-build` then generates Prisma Client, applies migrations, seeds the
catalog if it is empty, and runs `next build`. Later deploys skip the seed so
they do not duplicate listings. To rebuild the catalog from scratch, wipe the
`Listing` rows (or the database) and redeploy, or run `npm run db:reset`
against that `DATABASE_URL` locally.

Without Storage and `AUTH_SECRET`, the GitHub Vercel check stays red.

## How it's put together

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 → Postgres ·
Auth.js v5 · Vitest · Playwright.

The interesting logic is pure and unit-tested, deliberately kept out of
components so the cases that matter are reachable from a test:

| Module | Responsibility |
| --- | --- |
| `lib/scoring.ts` | Prices and scores one listing against one event |
| `lib/plan.ts` | Turns intake answers into a budget and a timeline |
| `lib/templates.ts` | What each event type needs, and in what order |
| `lib/budget.ts` | Rolls commitments up into a budget summary |
| `lib/guests.ts` | RSVP maths and the headcount to plan against |
| `lib/outreach.ts` | Drafts the first message to a vendor |
| `lib/runsheet.ts` | Builds a day-of schedule from your bookings |
| `lib/money.ts` | Integer-cent arithmetic and formatting |

A few decisions worth knowing about:

- **Money is integer cents, everywhere.** `allocateCents` splits a budget
  across weights without losing or inventing a cent.
- **Venues and vendors share one `Listing` table**, discriminated by `kind`.
  They share name, artwork, location, price and tags; splitting them would
  duplicate the whole search stack.
- **Event templates live in code, not the database.** They're typed planning
  logic that evolves with the app, and a change should be reviewable in a diff.
- **Timeline positions are fractions of a planning horizon**, so a wedding
  booked six weeks out compresses the 365-day template into the 42 days that
  actually exist rather than emitting overdue tasks.
- **The planning headcount starts from your estimate** and only moves for a
  real signal — a regret, or a guest list that outgrows the estimate. Using the
  guest list directly would reprice your venue for four guests the moment you
  typed the fourth name.
- **Inquiry drafts never mention your budget.** Telling a vendor what you have
  to spend is how it becomes what you spend.
- **Guests need no account.** The token in `/rsvp/[token]` is the
  authorization.

## Known limits

This is a working demo, not a production service. Specifically:

- **The catalog is invented.** All 78 venues and vendors are fiction — plausible
  names, prices and ratings chosen to exercise the scoring logic. None are real
  businesses. Listing artwork is generated locally from the listing id rather
  than photographed.
- **Nothing is sent.** HostKit drafts inquiry messages and per-guest RSVP links,
  but you copy and send them yourself. There is no email integration.
- **No payments.** Ticket price is shown to guests; you collect it yourself.
  The planner budget *tracks* money (committed, paid, outstanding) rather
  than moving it.
- **Discovery scores in application code**, not SQL. At catalog scale (tens per
  city) that's the right trade, since the price that matters is computed
  per-event; tens of thousands of listings would want it precomputed.
- **Light and dark.** Paper by default; Dark uses a warm night palette. System
  follows the device. The choice is saved in this browser.
- `npm audit` reports advisories inside the Prisma **CLI's** dependency tree
  (`mysql2`, a driver this project never uses, and `deepmerge-ts`). They are
  build-time only and reach neither the server runtime nor the browser bundle.

## Tests

143 unit tests cover the pure logic, including the boundaries that bite:
per-person pricing exactly at capacity, a budget that doesn't divide evenly, an
event whose date has passed, an unallocated category, an RSVP round that has
barely started.

`tests/e2e/spine.spec.ts` is one deliberately long Playwright test walking sign
up → intake → generated plan → filtered discovery → shortlist → drafted inquiry
→ booking → budget write-back → declining. The product's claim is that these
steps are connected, and that's only tested by walking the connection.

```bash
npm test          # unit
npm run test:e2e  # end to end (starts a dev server if one isn't running)
```
