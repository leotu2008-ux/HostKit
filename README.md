# Hosty

Plan an event end to end: scout venues and vendors, build the budget and the
timeline, track every booking, collect RSVPs, and print the run sheet.

Hosty is **host-side only**. Venue and vendor owners never log in and never
list anything — the catalog is seeded data, and every user is someone planning
an event. The Airbnb comparison describes the *scouting* experience
(photo-forward browsing, filters, saved shortlists), not a two-sided
marketplace.

## The idea

Because Hosty knows your event — date, headcount, city, budget — it can
price every listing *against that specific event*. A directory tells you a
venue is "$640/hour". Hosty tells you it's **"$5,120 for your 8 hours, 33%
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
npm run db:seed             # 72 venues and vendors across 3 cities

npm run dev                 # http://localhost:3000
```

Open the dev server as `localhost`, `127.0.0.1`, or your machine's Wi-Fi
address from a phone (`192.168.x.x:3000`) — those origins are listed in
`allowedDevOrigins` in `next.config.ts`. `next dev` refuses to serve its
scripts to any other hostname, and a page without scripts looks stuck on
the launch splash.

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

You can draft a night before you have an account. Publishing — listing it on
Discover or sharing a live guest link — needs a sign-in. Sign up with any
email and password. A confirmation link and password resets go out by email
once Resend is configured (until then the links are logged, and returned to
the client outside production) — see `docs/backend.md` for the whole backend
map: data, images, accounts, and which keys turn on what.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build and serve |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end spine test (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database. Seed is a no-op if the catalog already has rows. `db:migrate` and `db:reset` refuse a non-local `DATABASE_URL`. |
| `npm run db:studio` | Prisma Studio |
| `npm run import:campus-json -- path/to.json` | One-off CampusEvent upsert from a JSON dump. Refuses to run unless `DATABASE_URL` is set. |
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

## Students

Sign up with a school `.edu` email and Hosty treats you as a student of that
school (`lib/schools.ts` maps domains to names and home cities; the domain is
trusted, not verified yet). Your events are tagged with your school
automatically, Discover leads with **At [School]** above the city feed, and
both apps detect your city once from your location (nearest known city, no
geocoding service). Tagging only surfaces events — anyone nearby can register.
Demo student: `sam@babson.edu` / `hostkit-demo`. Design notes in
`docs/superpowers/specs/2026-09-11-campus-discover-design.md`.

You can also **pick or change your school** on your Profile (web and iOS),
alongside a **company** for hosts who work rather than study, and your
**X, LinkedIn and Instagram** under Connect (paste a handle or a profile
link; `lib/socials.ts` keeps just the handle and rebuilds the link). The
school matters because of the next part.

### Official campus events

Each school's public calendar is pulled into Hosty and shown next to
student-hosted nights: under **At [School]** on Home and Discover, on
`/campus` (the whole calendar by day, `?school=mit.edu` for another school),
and in the app's Discover → See all. Official events open on the school's own
page; nobody registers for them here.

- `lib/campus/sources.ts` lists the feeds per school — the catalog covers
  the Boston schools Hosty started with plus the U.S. News top 50, and
  53 of them have a verified feed: Localist JSON (MIT, BC, Northeastern,
  USC, UT Austin, Stanford, Yale, Cornell, WashU, UNC, UCSD, Purdue, UGA,
  Rochester, Wake Forest, FSU), iCalendar from LiveWhale (NYU, UChicago,
  Brown, Berkeley, Rice, Vanderbilt, CMU, Georgetown, UF, Texas A&M,
  Minnesota), Trumba (Tufts, Harvard's Gazette, UW, UVA, Brandeis) and
  home-grown calendars (BU, Duke, Notre Dame, Wisconsin), Bedework JSON
  (Columbia), CampusGroups RSS (Babson's *Belong* plus 20 other schools'
  student-org calendars), Anthology Engage (17 schools), Princeton's RSS,
  and plain HTML listings for schools with no feed (Babson's events page,
  Olin, Wellesley, Dartmouth, Rutgers). No public feed was found for
  Caltech, Johns Hopkins, Penn, Emory, UIUC, Ohio State or UCLA — they're
  in the catalog and show student-hosted nights only. Add a feed by adding
  a line.
- `lib/campus/parsers/*` turn each format into one shape;
  `lib/campus/sync.ts` stores it in `CampusEvent` (full replace per feed,
  next 90 days, wall-clock times like every other event).
- **When it runs:** `vercel.json` schedules `GET /api/cron/campus-sync`
  daily (set `CRON_SECRET`; Vercel sends it as a bearer token), and any
  student's feed older than six hours is refreshed in the background right
  after their request. Locally, `curl "localhost:3000/api/cron/campus-sync?school=babson.edu"`
  syncs one school on demand.
- `GET /api/v1/campus` and `discover.official` serve them as regular events
  with `official: { source, url, allDay, endsAt }` and ids prefixed
  `campus_`, so the iOS app's existing rows and detail screen show them.

## Your account

Both apps open on **Home**: the Hosty brand, **Your events** — what you
host and what you've registered for, soonest first (`lib/mine.ts`) — quick
actions, and a taste of what's on nearby. **Discover** (`/discover`) is the
full feed with the city picker. The logo (and your avatar) opens the account
menu: profile, your events, past events, settings, sign out; on phones the
tab bar is Home · Discover · Events · Profile (creating an event is behind
the "Create event" buttons, not a tab).

- **Profile picture** and **event covers** are uploads (`lib/images.ts`):
  JPEG/PNG/WebP up to 5 MB, downscaled in the client first. They go to
  Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, otherwise into Postgres
  and out through `/api/images/:id`, so local dev needs no storage service.
  Without a photo an event keeps the cover drawn from its id.
- **Phone number**, verified by a texted code (`lib/phone.ts`): six digits,
  hashed, ten minutes, five tries, one code a minute. Twilio sends the text
  when configured; otherwise the code is logged and — outside production —
  returned so the flow works locally. Hosts see registrants' verified numbers
  on the guest list.
- **Registering puts the event on your calendar and sets reminders.** On
  iOS the app adds it with write-only EventKit access (it never reads your
  calendar) and schedules local notifications for the evening before and an
  hour before — no server push; reminders re-sync from "Your events" on
  every Discover load, so a moved date moves the reminder. Both are toggles
  in Settings. On the web, registering shows Apple/Outlook (`.ics`, from
  `/e/:id/calendar.ics`) and Google Calendar links (`lib/calendar.ts`).
  Times are floating local time — 7:30 PM stays 7:30 PM.
- Everything is set in Inter, on the web and in the app.

## Clubs, requests and the Inbox

- **Clubs** (`lib/clubs.ts`) are pages people follow, run by an owner and
  admins: `/c/handle` on the web, a club page in the app. Any signed-in user
  can start one (`/clubs/new`); a student's club is tagged with their school
  and surfaces there. Events can be posted **as** a club from Create, the
  club's admins run those events alongside the owner, and followers see the
  club's events under **From clubs you follow** on Home.
  - Clubs have a **kind** (Social, Professional, Sports & fitness, Arts &
    music, Cultural, Service, Academic — `lib/club-format.ts`); `/clubs` and
    the app's Clubs screen search every club by name and browse by kind
    (`GET /api/v1/clubs?q=&category=` → `results`).
  - Admins post **Updates** from the club page: a short note that lands in
    every follower's Inbox (`club_update`, emailed when Resend is set up)
    and stays on the page (`ClubPost`; `POST /api/v1/clubs/:handle/updates`,
    `DELETE …/updates/:id`).
  - The event page's **Hosted by** row has a Follow button, and a club page
    shows past events and how many it has run.
  - **Official clubs are real.** When a feed names the organisation behind
    each event, the campus sync keeps a Club for it (`Club.sourceRef`,
    `isOfficial`; `lib/campus/sync.ts` `syncOfficialClubs`). Three kinds of
    feed do: **CampusGroups** sites (`<school>.campusgroups.com/rss_events`
    — Babson's *Belong*, plus Northeastern, Harvard, MIT, Tufts, Princeton,
    Northwestern, Columbia, Dartmouth, CMU, Georgetown, USC, UC Davis, UCI,
    UCSB, Wisconsin, Rutgers, UW, Lehigh, Rochester, FSU), **Anthology
    Engage** sites (`<school>.campuslabs.com/engage` — BC, UChicago, Berkeley, Rice, Notre Dame, Vanderbilt, Michigan, UVA, UNC,
    NYU, UF, UT Austin, Georgia Tech, Purdue, Maryland, UGA, Wake Forest),
    and **Localist** calendars, whose events carry a student group or a
    department. Official clubs carry an **Official** badge, nobody here runs
    them, their events come from the feed (`CampusEvent.hostRef`), and
    following one puts those events under From clubs you follow. Hosty
    never invents a club: seeds create none, and the only other way a club
    exists is a person starting one.
- **Approval and the waitlist** (`lib/registration.ts`, `lib/waitlist.ts`):
  Promote → "Approve registrations" turns registrations into requests the
  host answers from Overview. A full event takes registrations onto a
  waitlist and lets the longest-waiting in automatically whenever a seat
  frees. Register and promote run with the event row locked.
- **Who's going**: event pages show the first few attending account
  registrations — first name and photo — unless they've turned "Show me on
  guest lists" off in Settings (`lib/attendees.ts`).
- **Inbox** (`lib/notify.ts`): a club you follow posts, someone asks to join
  your event, a host confirms your spot, a spot opens for you, a host sends
  a blast — each lands in the Inbox (bell in the header; Home on iOS), goes
  by email for the ones worth an email when Resend is configured, and by
  **push** when `APNS_*` is set. Push needs a paid Apple developer team: add
  the Push Notifications capability and an `aps-environment` entitlement,
  set `HostyPushEnabled = true` in `ios/Config/Info.plist`, and the app
  registers its token; until then nothing on the phone changes.
- **SMS blasts**: with Twilio configured the composer offers "Also text N
  guests with a verified phone" (200 per blast).

## Hosting an event

**Registering needs an account.** Guests sign in or create one on the event
page and Hosty registers the account's email — that's the address blasts go
to (`lib/registration.ts`).

**Create** asks the essentials and, optionally, a venue: search real places
near your city (Google Places on the web, MapKit on iOS) or skip it if you
already have one. A picked venue becomes the event's address and the first
row in Outreach.

**Manage event** (`/events/:id`, and the Manage screen in the iOS app) has four
tabs:

| Tab | What's there |
| --- | --- |
| **Overview** | Going / checked-in / capacity, a "next up" checklist, the guest list with check-in |
| **Outreach** | Venue, speakers, vendors and cohosts in one list, each with a drafted first message (`lib/outreach.ts`), Copy / email / call, confirm or remove, add someone |
| **Blasts** | Email everyone going, those who haven't replied, or all — `{name}` becomes their first name. Sends via Resend when configured, otherwise hands you the addresses and message to paste (`lib/blasts.ts`, `lib/blast-send.ts`) |
| **Promote** | Publish and visibility, the share link, a QR code for posters and the door, paste-ready copy for a story or group chat (`lib/promote.ts`, `lib/qr.ts`) |

Optional services, both off by default (see `.env.example`):

| Variable | Enables |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Venue search on the website (Google Places API (New) Text Search). Enable Places API (New) in Google Cloud Console, create a key, set it on Vercel and redeploy. Places SKUs have a monthly free usage cap. Preferred when both Google and Apple are set. The iOS app uses MapKit directly and needs nothing |
| `APPLE_MAPS_TEAM_ID`, `APPLE_MAPS_KEY_ID`, `APPLE_MAPS_PRIVATE_KEY` | Fallback venue search on the website (Apple Maps Server API; a Maps key from developer.apple.com → Keys). Used only when `GOOGLE_MAPS_API_KEY` is unset |
| `RESEND_API_KEY`, `RESEND_FROM` | Real email blasts (resend.com, after verifying a sending domain). Without them blasts are recorded and copied by hand |
| `BLOB_READ_WRITE_TOKEN` | Photo uploads in Vercel Blob (Vercel → Storage → Blob). Without it photos are stored in Postgres |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Texting phone-verification codes and SMS blasts. Without them the code is logged (and returned in development) and blasts are email-only |
| `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_ENV` | Push notifications to the iOS app (a .p8 key from developer.apple.com → Keys; `APNS_ENV` is `sandbox` or `production`). Needs a paid developer team; until then notifications stay in the Inbox and email |
| `CRON_SECRET` | Protects `/api/cron/campus-sync`; Vercel sets it on the scheduled call. Without it the route only answers in development (the background refresh on stale feeds works regardless) |

## iOS app

`ios/` is a native SwiftUI app (iOS 26) on the same backend: Discover and
register, a host timeline, publish, guest check-in, and create — with Apple
Intelligence drafting event descriptions on-device and Siri shortcuts for the
door. Open `ios/Hosty.xcodeproj`; see [`ios/README.md`](ios/README.md).

It talks to the website through a small JSON API under `/api/v1`:

| Route | What it does |
| --- | --- |
| `POST /api/v1/auth/signup` | Name + email + password → account and token, in one step |
| `POST /api/v1/auth/token` | Email + password → 30-day bearer token |
| `GET /api/v1/me` | The token's user |
| `GET /api/v1/discover?city=` | Upcoming public, published events; with a token also `mine` (hosting + going) and a student's `campus` and `official` (the school's calendar) |
| `GET /api/v1/campus?school=` | A school's official calendar, soonest first, with `sources` and `syncedAt` |
| `GET /api/v1/schools` | The schools Settings can pick, and which have official feeds |
| `GET /api/cron/campus-sync` | Runs the sync (`Authorization: Bearer $CRON_SECRET`; `?school=` for one) |
| `GET /api/v1/events` · `POST` | The host's events · create one (with its plan). Signed out, `POST` makes a draft and returns a `claimToken` |
| `GET /api/v1/events/:id` | One event (public if live; owner or drafting device sees drafts) |
| `POST /api/v1/events/:id/register` | Register the signed-in account → `{ state: going \| pending \| waitlisted }` (401 without a token) |
| `POST /api/v1/events/:id/publish` | Publish / unpublish, optional `visibility` — needs sign-in; claims a draft on the way |
| `POST /api/v1/drafts/claim` | Attach a device's drafts to the signed-in host |
| `GET /api/v1/events/:id/guests` | Guest list and door counts |
| `POST /api/v1/events/:id/guests/:guestId/check-in` | Check in / undo |
| `GET /api/v1/venues/search?q=&city=` | Venue search (Google Places, or Apple Maps if Google isn't configured); `{ venues: [], unavailable: true }` when keys are missing |
| `GET /api/v1/events/:id/outreach` · `POST` | Everyone to reach, with drafted messages · add a venue / speaker / cohost |
| `PATCH /api/v1/events/:id/outreach/:rowId` · `DELETE` | Confirm / pending / declined · remove |
| `GET /api/v1/events/:id/blasts` · `POST` | Segments with counts, past blasts, `canSend` · send one (returns recipients when it couldn't email) |
| `PUT /api/v1/me/avatar` · `DELETE` | Profile picture — the image is the request body, with its `Content-Type` |
| `PUT /api/v1/events/:id/cover` · `DELETE` | Event cover photo, same shape; honours the drafts header |
| `POST /api/v1/me/phone` · `DELETE` | `{ phone }` → texts a code (`devCode` in development without Twilio) · remove the number |
| `POST /api/v1/me/phone/verify` | `{ code }` → the number goes on the account |
| `PATCH /api/v1/events/:id/guests/:guestId` | `{ status }` — approve / decline a request, change a reply; frees seats to the waitlist |
| `GET/POST /api/v1/clubs` | Clubs you manage + suggestions for your school or city · start one |
| `GET/PATCH /api/v1/clubs/:handle` | A club page (club, upcoming events, admins) · edit details |
| `POST/DELETE /api/v1/clubs/:handle/follow` · `…/members` · `PUT/DELETE …/avatar` | Follow / unfollow · add or remove admins · the club's picture |
| `GET /api/v1/me/notifications` · `POST …/read` | The Inbox with the unread count · mark read |
| `PUT/DELETE /api/v1/me/push-token` | The iOS device token (answers `pushEnabled`) |

Like the website's draft cookie, a signed-out device proves it made a draft
by sending `X-Hosty-Drafts: id.token,id.token` (`lib/api/drafts.ts`).

Web and API share their rules: `lib/event-create.ts` builds an event and its
plan, and `lib/registration.ts` decides who can register — an existing guest is
never renamed and a declined guest can't be flipped back by someone who knows
their email.

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
- **Timeline positions are fractions of a planning horizon**, so a fundraiser
  booked six weeks out compresses the 120-day template into the 42 days that
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

- **The catalog is invented.** All 72 venues and vendors are fiction — plausible
  names, prices and ratings chosen to exercise the scoring logic. None are real
  businesses. Listing artwork is generated locally from the listing id rather
  than photographed.
- **Inquiries aren't sent.** Hosty drafts inquiry messages and per-guest RSVP
  links, but you copy and send those yourself. Account email (resets,
  verification), blasts and club posts do go out once Resend is configured.
- **No payments.** Ticket price is shown to guests; you collect it yourself.
  The planner budget *tracks* money (committed, paid, outstanding) rather
  than moving it.
- **Discovery scores in application code**, not SQL. At catalog scale (tens per
  city) that's the right trade, since the price that matters is computed
  per-event; tens of thousands of listings would want it precomputed.
- **Light and dark follow the device.** The website switches on
  `prefers-color-scheme` and the iOS app on the system appearance; neither has
  an in-app override, so both always match the phone or computer they're on.
- `npm audit` reports advisories inside the Prisma **CLI's** dependency tree
  (`mysql2`, a driver this project never uses, and `deepmerge-ts`). They are
  build-time only and reach neither the server runtime nor the browser bundle.

## Tests

148 unit tests cover the pure logic, including the boundaries that bite:
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

## MCP

Hosty exposes one remote MCP endpoint, `POST /api/mcp`, with two credentials.

- **Bearer token.** Cursor, and any client that can send `Authorization: Bearer`. The token comes from `POST /api/v1/auth/token` or the Connect an agent page (`/mcp`). Tools: `list_events`, `get_event`, `list_guests`, `campus_events`, `discover_events`.
- **OAuth.** Claude and ChatGPT custom connectors. Consent, refresh, and disconnect live under Settings → AI connections. Tools: `list_events`, `get_event_brief`, `search_venues`.

An OAuth access token is checked first. Anything that is not a live grant falls through to the bearer token. See [docs/mcp.md](docs/mcp.md).
