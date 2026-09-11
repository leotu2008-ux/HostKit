# HostKit for iOS

A native SwiftUI app for HostKit. It talks to the same backend as the website
through `/api/v1`, so an event created on the phone shows up on the web and the
other way round.

## Requirements

- Xcode 26 (iOS 26 SDK)
- An iOS 26 simulator runtime, or a device on iOS 26
- Apple Intelligence features need an Apple Intelligence–capable device with it
  turned on. Everything else works without it.

## Run it

1. Open `ios/HostKit.xcodeproj` in Xcode.
2. Pick your team under **Signing & Capabilities** (only needed for a device).
3. Run the **HostKit** scheme.

By default the app talks to `https://host-kit-one.vercel.app`. Until this
branch is deployed there, the site has no `/api/v1`, so Discover shows built-in
sample events and says so. To use real data:

- **Local:** run `npm run dev` in the repo, then in the app go to **You → Server**
  and enter `http://localhost:3000` (the Simulator can reach your Mac's
  localhost).
- **Preview:** enter the Vercel preview URL for this branch.

You can create events without an account. They're saved as drafts on the
phone (a claim token per draft, in UserDefaults) and show on the Events tab.
Publishing asks you to sign in, then hands the draft to that account. Sign in
with a website account, e.g. the seeded demo host `maya@hostkit.demo` /
`hostkit-demo`.

Build from the command line without signing:

```bash
xcodebuild -project ios/HostKit.xcodeproj -scheme HostKit \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## What's in it

| Tab | Screens |
| --- | --- |
| **Discover** | "Your events" first (hosting + going), then campus and city feeds grouped by day, event page with register sheet |
| **Events** | Your events as a timeline (upcoming / past) and Manage — Overview (guest list, check-in, tap the cover to add a photo) · Outreach (drafted messages, call / email, confirm) · Blasts (email the guest list) · Promote (publish, visibility, share link, QR code, promo copy) |
| **Create** | The event form, with an optional MapKit venue search and a cover photo |
| **Logo (top-left)** | The account menu: profile (with photo), past events, settings (reminders and calendar toggles, phone number verified by text, server address, Apple Intelligence, Siri), sign in / out |

Registering for an event adds it to your calendar (`App/CalendarSync.swift`,
write-only EventKit access) and schedules two local notifications — the
evening before at 6 pm and an hour before (`App/Reminders.swift`). Reminders
are re-synced from "Your events" whenever Discover loads; tapping one opens
the event. No push server is involved.

Everything is set in Inter (`Design/Typography.swift`; the four static faces
are bundled under `Resources/Fonts`).

### Apple Intelligence

- **Foundation Models** — on Create, *Write with Apple Intelligence* drafts a
  tagline and description from the event's details and your notes, entirely
  on-device (`Intelligence/DescriptionWriter.swift`). The button hides itself
  and explains why when the model isn't available. On Manage → Promote,
  *Rewrite with Apple Intelligence* turns the event into a short post for a
  story or group chat.
- **App Intents** (`Intents/HostKitIntents.swift`):
  - "What's my next event in HostKit" — answers with the time and headcount.
  - "Check in a guest with HostKit" — asks for the guest and event, checks them in.
  - "Open *event* in HostKit" — jumps to that event's Manage screen.

## Layout

```
HostKit/
  App/            entry, tab root, router, app model, session + Keychain
  Networking/     API client, models (mirror lib/api/serialize.ts), sample data
  Design/         cover art (same algorithm as the website), date formatting, shared views
  Features/       Discover, Event, MyEvents, Manage, Create, Profile
  Intelligence/   Foundation Models description writer
  Intents/        Siri / Shortcuts
```

The project uses Xcode's folder-synchronised groups: add a Swift file anywhere
under `HostKit/` and it's part of the target, no project-file edits needed.

## Notes

- **Times.** The website stores an event's start as the host's wall-clock time
  encoded as UTC, so the app formats start times in UTC (`EventDates`). Check-in
  times are real instants and use the device's time zone.
- **Covers** are generated from the event id with the same hash and palettes as
  `components/cover-art.tsx`, so an event looks the same on both.
- **Tokens.** Sign-in returns a 30-day bearer token (`lib/api/token.ts`), stored
  in the Keychain.
