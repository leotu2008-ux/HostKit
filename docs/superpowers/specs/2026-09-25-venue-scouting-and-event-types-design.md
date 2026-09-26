# Venue scouting and more event types

Date: 2026-09-25. Status: written for review.

## Why

Hosty lines up venues that don't suit the night. A mixer searches Google for
the single word `"bar"`, gets 12 results, and Jev (when on) only re-orders
them: a place Jev calls "Wrong kind of place for this event" can still be one
of the three Hosty lines up. A networking night is filed as a mixer, so it
gets the same bars. Free rooms (a university, a public library) are never
considered, and the ten event types leave out nights recurring hosts run
every week: workshops, talks, hackathons, trivia, watch parties.

## What the host gets

- A wider list of event types, networking night among them.
- Every venue Hosty lines up suits the type of night. Code throws out places
  whose Google/Apple type is wrong for it, and Jev throws out the ones it is
  confident don't fit. If nothing suits, Hosty says so instead of lining up
  something wrong.
- One free option, when one exists nearby: a university (tagged "may be free
  for students, check with the school") or a public library or community
  centre (tagged "often free, check with them"). Shown to every host
  (decision B, 2026-09-25), not only students.

Unchanged: Hosty never books or sends anything; each venue still arrives with
a drafted inquiry the host sends themselves. No weddings or family occasions.

## Decisions

1. **Networking night is its own event type**, not a mixer. Recommended in
   chat and not objected to; the event-type research below includes it.
2. **Eight new event types**, from the formats Eventbrite lists (workshop,
   seminar, screening, tournament, performance, networking) and the event
   types student organisations run most (workshops, panels and speakers,
   networking nights, hackathons, talent shows):

   | Value | Label | Planning shape |
   | --- | --- | --- |
   | `NETWORKING` | Networking night | Room you can hear each other in, drinks, name tags |
   | `WORKSHOP` | Workshop | Tables, a screen, an instructor |
   | `SPEAKER_EVENT` | Speaker event | Talk, panel or fireside chat: stage, mics, Q&A |
   | `HACKATHON` | Hackathon | 24 hours, power, wifi, food through the night |
   | `GAME_NIGHT` | Game night | Trivia, board games, a host with a mic |
   | `WATCH_PARTY` | Watch party | Big screen and sound for a match or a film |
   | `SHOWCASE` | Showcase | Open mic, talent show, performance |
   | `RUN_CLUB` | Run club | Meeting point, a route, coffee after |

   Conferences stay under Corporate offsite, and career fairs are left out:
   schools run them, not recurring hosts.
3. **Free campus rooms mean universities only** (Google type `university`,
   Apple `University`). Google's generic `school` type also covers driving
   and dance schools, and K-12 schools don't host outside adult events, so
   both are out.
4. **The Jev veto only removes on confidence.** A venue goes when Jev is
   confident it is the wrong kind of place for the type, rates its fit 0 or 1
   (wrong kind, a stretch), or says it has no private space for a type that
   needs one. When Jev is unsure the venue stays, tagged "worth a look", as
   today. When Jev vetoes everything, the result is an empty list, never the
   old unfiltered ranking.
5. **Free options skip Jev.** Jev sees only a name, a category and an address,
   and can't know whether a campus has a room to lend. Code decides which
   event types a free source suits.
6. **iOS stays frozen.** Its `EventKind` already decodes unknown types as
   `.unknown` ("Event"), and its edit route never sends `type`, so the new
   values are safe without an iOS change.

## Design

### Part A: event types

`EventType` gains the eight values in one migration (`ALTER TYPE ... ADD
VALUE IF NOT EXISTS`, as in `20260919120000_campus_event_types`). Every
`Record<EventType, …>` gets an entry, so the compiler lists the work:
`EVENT_TYPE_LABEL` (catalog), `EVENT_TEMPLATES` (budget, horizon, tasks),
`DEFAULT_START_HOUR` and `RUNNING_ORDER` (run sheet), `BASE_QUERY` (venue
query), `CATEGORY_KEYWORD` (deterministic rank). `BY_EVENT_TYPE` (icons) and
`KIND_KEYWORDS` (the brief's keyword table) are not exhaustive, so tests pin
them. The picker order puts `NETWORKING` second, after `MIXER`. The keyword
table moves "networking", "workshop", "panel" and "speaker" off the types that
hold them today, and lists the specific types before the catch-alls
(`GENERAL_MEETING`, `MIXER`, whose "night" would otherwise catch "game
night"). Jev's brief classifier and the plan-drafting prompt read
`ALL_EVENT_TYPES`, so they pick the new types up without changes.

### Part B: venue scouting

A new pure module, `lib/venues/suitability.ts`, holds one profile per event
type:

- `searches`: two or three extra search phrases ("cocktail lounge", "hotel
  bar", "event space" for a networking night).
- `googleTypes` / `appleCategories`: the place types that suit it.
- `excludedTypes`: types that rule a place out even when another type matches
  (a networking night excludes `night_club`, `sports_bar`, `karaoke`).
- `spaceKinds`: the Jev `SpaceKind`s that suit it.
- `needsPrivateSpace`: false for run clubs, game nights, watch parties and
  study breaks, where a table in a public room is fine.
- `freeSources`: which free sources apply (`campus`, `public`).

`VenueResult` gains an optional `types: string[]`: Google's `primaryType` and
`types` (the field mask adds `places.types`), Apple's `poiCategory`.
`placeFit(venue, type)` returns `"yes"`, `"no"` or `"unknown"` (no type info:
kept, and left to Jev). `freeSourceFor(venue, type)` returns the free source a
place belongs to, if that source applies to the type; campus wins over public
when a place is both, such as a university library.

A new `lib/venues/scout.ts`, `scoutVenues(event)`, runs the existing
`venueQueryFor` query plus the profile's searches and the free sources'
searches, in parallel. A failed search is skipped; if every search fails it
throws, as `searchVenues` does today. It de-duplicates by place id and
returns `{ suitable, free }`: free places, then places whose fit isn't
`"no"`. At most five searches per scout (one base, up to two profile
searches, up to two free), against one today.

`judgeVenues` gets the veto from decision 4, reads `spaceKinds` and
`needsPrivateSpace` from the profile, and hears the host's own words for the
night (`event.kind`, the same field Jev's brief point already receives).
Budget, guests and contact details still never reach Jev.

The agent's venue step (`attachTopVenues`) and the host's "Find venues"
button (`findVenuesAction`) both call `scoutVenues`, then rank `suitable` as
they do now. They add the closest free place within 40 km as one more option
past the limit, so a free room never pushes out a suitable paid one. The
agent's line reads "Harvard University (may be free for students)", in the
same form as "(worth a look)". The MCP venue tool and the iOS search route
keep the raw search: they take a query the caller wrote.

## Error handling

- One of the searches fails: the rest are used. All fail: the same "Venue
  search isn't answering" / step failure as today.
- Jev off, slow or silent: the type filter still runs, so venues still suit
  the night; ranking falls back as it does today.
- Nothing suitable and nothing free: `venue_search_empty` ("I couldn't find
  venues nearby yet.").

## Testing

Unit tests, in the repo's render/pure-function style (no source-grep tests):
exhaustive-per-type checks for labels, templates, run sheets, keywords, icons
and profiles; `placeFit` and `freeSourceFor` truth tables; `scoutVenues` with
a stubbed search (dedupe, partial failure, all failing, free partition); the
veto in `judgeVenues` with the existing stubbed-Jev harness; `pickLineup`
(the free option added past the limit, and the closest free place chosen).

## Costs

Google Places: up to five Text Search requests per scout instead of one.
Jev: unchanged per candidate (at most 8), minus the free options.

## Out of scope

Paging through Google results, a nightly city crawl, saving Jev's per-place
answers, school booking systems (25Live, EMS), iOS changes, and switching Jev
on in production (still blocked on the Hobby plan's zero-data-retention
limit).
