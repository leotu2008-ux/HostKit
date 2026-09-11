# Campus Discover — design

Undergrads find the events happening at their school and around it, without
those events being locked to outsiders. Approved 2026-09-11.

## Decisions

- **Students are identified by a `.edu` email.** No verification email yet: the
  domain is trusted (`whoever@babson.edu` is a Babson student). Verification
  can be added later without changing the data model.
- **Schools live in code** (`lib/schools.ts`): domain → name → home city. Any
  other `.edu` domain still counts as a student, with the school named from
  the domain and no home city.
- **Events are tagged with the host's school automatically.** Nothing extra on
  Create. Tagging is about surfacing, not access: anyone can see a campus event
  in their city feed and register for it.
- **Area = city.** Boston joins the city list. Both apps ask for location once,
  pick the nearest known city (no geocoding service), and remember it; the
  city chips remain a manual override.

## Model

- `User.schoolDomain`, `classYear`, `bio` — set at sign-up from the email;
  editable on the profile (school is not).
- `Event.schoolDomain` — copied from the host at create, or at claim/publish
  for drafts made before signing in.

## Discover

- Student: **At [School]** (upcoming public events tagged with their school)
  above **Around [City]** (everything public in the city, campus events
  included).
- Everyone else: the city feed. Campus events show a school chip.
- Default city: explicit choice → remembered detection → school's home city →
  everywhere.

## API

- `GET /api/v1/discover?city=` returns `{ events, campus, school }`; `campus`
  is filled for a signed-in student.
- `GET /api/v1/me` includes `school`, `classYear`, `bio`; `PATCH /api/v1/me`
  updates name, class year and bio.
- Event payloads carry `school: { domain, name, short } | null`.

## Out of scope for this pass

Email verification, school pages, org/club accounts, per-school privacy.
