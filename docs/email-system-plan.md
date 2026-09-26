# Hosty email system — Phase 0 plan

Status: **plan only**. Nothing in this document is implemented. No schema
migration, no dependency, and no runtime code ships with it.

Product copy says **Hosty** (`tryhosty.app`). The GitHub repo and the npm
package stay **HostKit**. This plan does not rename identifiers.

## 1. Current-state findings

### Stack

| Piece | What the repo actually uses |
| --- | --- |
| App | Next.js 16.3.4 (App Router), React 19.2.8, TypeScript, Tailwind v4 |
| Data | Prisma 7.10 → Postgres. Models use `cuid()` ids and camelCase fields. `vercel-build` runs `prisma migrate deploy` and the seed only when `VERCEL_ENV` is `production`. Preview and development builds skip both. A preview with schema changes may error until the migration lands on `main` |
| Auth | Auth.js / next-auth v5 beta (`next-auth@5.0.0-beta.32`), **credentials only** (`lib/auth.ts`). JWT sessions. Passwords are bcrypt (`bcryptjs`). App API uses 30-day HMAC bearer tokens (`lib/api/token.ts`) |
| Email libraries | `nodemailer` and `@types/nodemailer` are already dependencies. There is **no** Resend, Postmark, React Email, MJML, Inngest, Trigger.dev, Bull, or Vercel Workflow package |
| Jobs | Vercel Cron in `vercel.json`: `campus-sync`, `close-events`, `agent-briefing`, `agent-run`. Routes under `app/api/cron/*` check `CRON_SECRET`. Deferred work already uses `after()` from `next/server` (`lib/agent/trigger.ts`) |
| Tests | Vitest. Email transport, failure classification, waitlist confirmation, and approval-invite failures are covered |
| Host | One Vercel project named `hosty`. Preview and production share one database at runtime, but only a production build applies migrations (README). A preview with schema changes may error until the migration lands on `main`. iOS is a separate SwiftUI client of `/api/v1` and does not send mail itself |

Auth.js does not send mail. There is no Email, magic-link, or OAuth provider in
`lib/auth.ts`. Supabase, Clerk, and Firebase are not in this app. Every
message Hosty sends is application code calling `sendEmails`.

### How a send leaves the building

`lib/email/send.ts` is the only switch:

1. If `RESEND_API_KEY` and `RESEND_FROM` are both set, send with Resend's
   batch HTTP API (`lib/email/resend.ts`, `POST https://api.resend.com/emails/batch`, chunks of 100).
2. Otherwise, if `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
   are all set, send with nodemailer (`lib/email/smtp.ts`). `SMTP_PORT`
   defaults to 587 (STARTTLS); 465 is implicit TLS. `.env.example` shows
   `smtp.gmail.com` and a Gmail app password.
3. If neither is set, `sendEmails` throws. Callers that must not pretend
   (sign-up verification, product-waitlist confirmation, waitlist approval
   invite, vendor outreach) refuse. Password-reset and "resend confirmation"
   swallow the failure so the form cannot be used to enumerate accounts.
   Blasts are stored as `provider: "manual"` and the host copies recipients.

**Resend wins whenever both are configured.** That is the signup-mail failure
mode the SMTP path was added to escape. Resend authenticates a domain and,
until that domain is verified, delivers only to the Resend account owner's
address. SMTP authenticates a mailbox and can deliver to anyone, with no DNS.
The comments in `lib/email/send.ts`, `lib/email/smtp.ts`, and `.env.example`
describe this exactly. `docs/backend.md` is behind the code: it still says
email needs `RESEND_API_KEY` and `RESEND_FROM` and does not mention SMTP. The
README (optional-services table) matches the code.

This agent could list the Vercel project (`hosty`) and could not read its
environment variable names (403 on the team scope). Live Production values
were not inspected. The contract in code, `.env.example`, and the README is
`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` and
`RESEND_API_KEY` / `RESEND_FROM`. Prior production use of Gmail SMTP is
consistent with that contract and with the tests in
`tests/unit/email-transport.test.ts`, which treat `smtp.gmail.com` as the
SMTP example. Confirm the live set in the Vercel dashboard before cutover
(Leo's steps below). Do not turn Resend on in Production while the sending
domain is unverified: the switch will prefer Resend and signup mail to
everyone except the account owner will fail again.

### What a message looks like today

`OutgoingEmail` is `{ to, subject, text, replyTo? }`. Both transports send
**plain text only**. There is no HTML part, no attachments, no
`List-Unsubscribe`, and no provider idempotency key.

Both transports already send **one recipient per message**. Resend puts a
single address in `to: [email.to]`. SMTP calls `sendMail` inside a loop.
Nobody is placed in Cc. The manual blast fallback is the exception: when
sending is off, `components/blast-composer.tsx` builds a `mailto:` link with
every guest in `bcc`.

Sends run **inside the request** that triggered them (server actions and
`/api/v1` handlers). There is no outbox, no retry, and no backoff. A thrown
`EmailSendError` fails the action, except `notify()` and password-reset,
which log and continue.

Idempotency that exists today is row-claiming, not a send key:

- Vendor inquiries (`lib/actions/inquiries.ts`) and collaborator outreach
  (`lib/actions/collaborators.ts`) set `sentAt` / `status: SENT` before
  calling `sendEmails`, and only roll that claim back when the provider
  explicitly rejects the sender or the recipient. An unknown failure (timeout)
  stays claimed so a retry cannot double-send.
- `AccountToken` replaces any previous `reset` or `verify` token for that
  user before the new link is sent. A second request invalidates the first
  link. The send itself can still happen twice.
- `Blast` has no uniqueness. Two clicks send two blasts.

`Blast.provider` is set to `"resend"` whenever **any** transport succeeds,
including SMTP (`lib/blast-send.ts`).

### Auth mail, tokens, and logging

`lib/account.ts` issues 32-byte tokens, stores only `sha256`, and marks
`usedAt` on consume. TTLs:

| Kind | TTL | What opening it does |
| --- | --- | --- |
| `verify` | 24 hours | Sets `User.emailVerifiedAt`. Sign-in is refused until then |
| `reset` | 1 hour | Sets a new bcrypt password, bumps `sessionVersion`, and also sets `emailVerifiedAt` |
| Approval invite | 7 days | Same path as `reset`: a set-password link from `/admin/waitlist` |

There is no magic-link sign-in and no email one-time code. Phone
verification (`lib/phone.ts`) is the code pattern to copy: 6 digits, bcrypt
hash, 10 minutes, 5 attempts, 60-second resend gap. Those codes go out by
Twilio, or to the log when Twilio is unset.

When no transport is configured and `NODE_ENV !== "production"`, account
mail logs the **full link, including the raw token**, and returns it to the
client as `devLink`. Production without a transport returns 503 for sign-up
and does not return the link. **Preview is not protected by that check.**
Vercel preview sets `NODE_ENV=production`. If Preview has `SMTP_*` or
`RESEND_*`, preview sends to real addresses. Preview also migrates the
production database.

User-facing setup errors in `lib/account.ts` (`NOT_DELIVERABLE_MESSAGE`,
`sendBlockedMessage`) still tell the person to fix Resend, including when
the failure was SMTP.

School email is not a separate verification. `schoolDomainFor` copies a
`.edu` domain off the signup address (`lib/schools.ts`). The README and
`docs/backend.md` both say that domain is trusted, not verified. Profile
lets the account change school with no code.

There is no change-email flow, no new-device record, no welcome mail, and
no self-serve account deletion (`docs/backend.md`, "Not built yet").

### Guest mail vs account mail

Two guest paths exist:

- **Account registration** (`lib/registration.ts`, web and
  `POST /api/v1/events/:id/register`). The guest is a `User`. A new
  `PENDING` request calls `notify()` with kind `registration_request`.
  That kind is **not** in `EMAIL_KINDS`, so the host gets an Inbox row and
  push (if APNs is on), and **no email**.
- **Token RSVP** (`/rsvp/[token]`, `submitRsvpAction`). No account. The
  `Guest.rsvpToken` is the credential. Replying updates the row and writes
  an activity line. **No email** to the guest or the host.

`notify()` emails only `User.email` for kinds in `EMAIL_KINDS`:
`club_published`, `club_update`, `registration_approved`,
`waitlist_promoted`, `agent_briefing`. Approval and waitlist-promotion
mail therefore skip a `Guest` who has an email but no `userId`. Declining
a request sends nothing. `registration_request` and `blast` are Inbox-only
inside `notify` (the blast email is sent earlier by `sendBlast`, from
`Guest.email`).

`lib/qr.ts` renders an SVG of a URL for the promote page and the door. It
is not attached to mail. `lib/calendar.ts` (`icsFor`) builds an `.ics` for
the product UI. It is not attached to mail. Nothing sends a 24-hour or
2-hour reminder. Nothing emails on event edit, cancellation, or
"capacity reached" (`Event.guestCount` is the planned cap in heads; attending
heads, each guest plus their plus-ones, are computed by `attendingHeads` in
`lib/waitlist.ts`).

Host blasts (`lib/blast-send.ts`) build the recipient list on the server
from RSVP status (`lib/blasts.ts`: `going`, `pending` which is status
`INVITED`, `waitlist`, `everyone` excluding declined, waitlisted and
unapproved requesters, and `came`: attending guests checked in at the door,
offered only once the night has happened and the door was run).
`{name}` becomes the first name. Reply-To is the host. Every blast email
ends with `— {host} via Hosty. Reply to this email to stop getting updates
about {event}.` (`emailText`, mirroring the SMS footer). That reply is a
stopgap: it reaches the host, who has to act on it by hand. There is no blast
rate limit (`LIMITS.outreach` is 30/hour and covers vendor mail only), no
unsubscribe link, and no preference. The host's body is plain text today, so it
cannot carry HTML, but nothing strips CR/LF from the subject before it is
placed in a header. The composer shows a live count for the selected
segment. It does not show a rendered preview of each recipient's body
before send.

Club posts (`lib/clubs.ts`) and "a club published an event" (`lib/publish.ts`)
go out through the same transport as password resets. A host blast and a
sign-in mail share one From address and one reputation.

Vendor and co-host outreach (`inquiryEmail` in `lib/outreach.ts`) is
host-edited plain text, one recipient, Reply-To the host. A `COHOST`
collaborator is a contact the host is lining up. It is not an account
grant to manage the event. Club `ADMIN` is the closer thing to a co-manager,
and adding one does not send a dedicated invitation email.

### Env vars that matter

| Name | Role today |
| --- | --- |
| `RESEND_API_KEY`, `RESEND_FROM` | Turn on Resend. Both required. Wins over SMTP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Turn on nodemailer. Documented as Gmail / Zoho / Fastmail |
| `SITE_URL` | Absolute links in mail. Falls back to the request origin (`lib/site.ts`) |
| `CRON_SECRET` | Bearer token for existing crons. Reuse for the future drain |
| `VERCEL_ENV` | Not consulted. This is the correct production-vs-preview switch |
| `TWILIO_*` | SMS only. Out of this plan's send path |
| `AUTH_SECRET` | Session signing. Not an email secret |

## 2. Inventory

"Current" means the code path exists and will send when a transport is
configured. "Launch" is the scope in the brief. Several current sends are
not in that list; they still have to move onto the new transport so they
stop sharing a mailbox with sign-in mail.

| Email | Audience | Current | Launch scope | Stream |
| --- | --- | --- | --- | --- |
| Confirm address (`verify` link, 24h) | New account | Sent, text, inline | Email verification. Shorten only if Leo wants; see open questions | Transactional |
| Resend confirmation | Unverified account | Sent, blind (no enumeration) | Same | Transactional |
| Password reset (1h) | Account | Sent, blind | Password reset. Passwords exist | Transactional |
| Product-waitlist confirmation | `EmailListEntry` | Sent, required | Not in the launch list. Keep it; it is the invite-only front door | Transactional |
| Waitlist approval / set password (7d) | Approved person | Sent, required | Not named. Keep it; it is how invite-only access is delivered | Transactional |
| Welcome | Account | Missing | In scope, after the address is confirmed | Transactional |
| Magic link or sign-in code | Account | Missing. Sign-in is email + password | In scope. New, do not replace passwords in the same change | Transactional |
| School email code | Account | Missing. `.edu` is trusted | In scope | Transactional |
| Email changed, notice to old and new | Account | Missing. No change-email action | In scope | Transactional |
| New sign-in from an unrecognized device | Account | Missing. No device table | In scope | Transactional |
| Account deleted | Account | Missing. No self-serve delete | In scope, blocked on the deletion feature | Transactional |
| RSVP received | Guest | Missing. Token RSVP and account register send nothing to the guest | In scope | Transactional |
| Approved | Guest | Inbox + email only when the guest has a `userId` | In scope, including guests who only have `Guest.email` | Transactional |
| Waitlisted | Guest | Same gap as approved | In scope | Transactional |
| Promoted from waitlist | Guest | Same gap | In scope | Transactional |
| Declined | Guest | Missing | In scope | Transactional |
| Confirmation with check-in QR and `.ics` | Attending guest | Missing. QR and `.ics` exist for the UI only | In scope | Transactional |
| Reminder 24h and 2h | Attending guest | Missing. No reminder cron | In scope | Transactional |
| Event updated | Guest | Missing | In scope. Define "material change" before building | Transactional |
| Event cancelled | Guest | Missing. `EventStatus.CANCELLED` exists | In scope | Transactional |
| New RSVP awaiting approval | Host | Inbox only, one notification per request, not emailed, not batched | In scope as a **batched digest** | Transactional |
| Capacity reached | Host | Missing | In scope | Transactional |
| Co-host invitation | Co-host | Outreach draft only (`CollaboratorKind.COHOST`), not a manage-access invite | In scope, meaning needs a decision (open questions) | Transactional |
| Host blast | Guests in a segment | Sent, text, one each, Reply-To host, or manual copy with a BCC mailto | In scope on the blast stream, with rate limits, unsubscribe, preview, count | Blast |
| Club update | Followers | Sent via `notify` | Not in the launch list. Move to the blast stream so it cannot hurt sign-in | Blast |
| Club published an event | Followers | Sent via `notify` | Not in the launch list. Blast stream | Blast |
| Vendor / collaborator inquiry | One business or person | Sent, host-edited text, Reply-To host, claim-before-send | Not in the launch list. Keep on transactional (one recipient, low volume) | Transactional |
| Agent daily briefing | Host | Sent via `notify` from `agent-briefing` cron | Not in the launch list. Transactional; it is mail to the account owner about their own event | Transactional |

SMS blasts and APNs stay as they are. This plan does not fold them into the
email queue.

## 3. Recommendations

### Provider: Resend, with Gmail SMTP retired from production

Keep Resend. The HTTP client, failure classifier (`sender` / `recipient` /
`unknown`), env names, and tests already exist. The signup failures were
the unverified-domain restriction plus "Resend wins if both are set", not
a missing provider.

Gmail SMTP is enough to deliver a message. It is not enough for this
system:

- One mailbox and one From. Sign-in mail and host blasts share Gmail's
  reputation and Gmail's daily cap.
- No separate domain reputation and no signed bounce or complaint webhook
  to drive suppression.
- A consumer Gmail account will not survive a real guest list.

**Domains, since Resend has no Postmark-style message streams.** Verify two
subdomains and send each stream from its own:

- Transactional: `mail.tryhosty.app`, From `Hosty <mail@mail.tryhosty.app>`
  (final local-part is Leo's). Auth, RSVP outcomes, reminders, vendor
  inquiry, agent briefing, product waitlist.
- Blasts: `notify.tryhosty.app`, From `Hosty <news@notify.tryhosty.app>`.
  Host blasts, club updates, club-published notices. Reply-To stays the
  host for blasts, so replies do not land in a mailbox nobody reads.

Resend tracks reputation per domain. A complaint on `notify.` does not
touch `mail.`. That is the isolation this app can get without a second
vendor.

**Postmark** is the alternative if Leo wants named Transactional and
Broadcast streams, including broadcast's built-in unsubscribe
bookkeeping. Choosing it means replacing `lib/email/resend.ts` and
`lib/email/failure.ts`. Do not run both providers.

Production cutover order: verify both domains and send a test to an
address that is **not** the Resend account owner, then set `RESEND_*` on
Production, then remove `SMTP_*` from Production. Leaving SMTP in place
is harmless only while Resend is unset. The moment both are set, SMTP is
ignored.

Nodemailer stays for a local catcher (Mailpit or similar on
`localhost:1025`) in development. It is not a production transport after
cutover.

### Templates: React Email

The UI is React 19, so templates should be React Email
(`@react-email/components` rendered with `@react-email/render`), one
component per template under `emails/`. Each render returns **HTML and
plain text**. Add the dependency in the template PR, not in this one.

Host-authored blast and inquiry bodies are not React trees. They are
escaped plain text dropped into a fixed shell (greeting line, footer,
unsubscribe link). No raw HTML, no `<script>`, no `<img>` whose URL came
from the host. `{name}` remains the only interpolation, and the name is
escaped. A blast body that contains HTML tags is shown as text.

QR codes in the confirmation mail are generated by the existing `qrcode`
package as a PNG (email clients drop inline SVG) and attached or hosted
on `tryhosty.app`. The URL encoded in the QR is the guest's own check-in
or RSVP link, built with `SITE_URL`. The `.ics` comes from `icsFor` in
`lib/calendar.ts` as an attachment. Neither asset is a remote image
supplied by the host.

### Auth routing

Do not add Auth.js's Email provider. It would send Auth.js's default
template and a second token system. Keep credentials sign-in. New magic
links and codes are `AccountToken` rows (or a code row copied from
`PhoneVerification`) and our React Email templates, sent on the
transactional domain through Resend's API.

The brief's "custom SMTP" clause is how you stop Supabase, Clerk, or
Firebase from using their own templates. Those products are not here.
Resend's HTTPS API is the production path: it already returns the status
codes `lib/email/failure.ts` understands, and it accepts an
`Idempotency-Key` header. Resend's SMTP endpoint (`smtp.resend.com`) would
keep nodemailer in production and drop batch sends and that header. Use
it only if some future auth host requires an SMTP URL. Document
`smtp.resend.com` in Leo's steps as optional, not the plan.

### Queue: Postgres outbox, `after()`, and the existing cron

Do not add Inngest, Trigger.dev, Bull, or Vercel Workflow. The repo
already defers work with `after()` and already sweeps on a
`CRON_SECRET`-guarded route.

1. The request inserts an `EmailMessage` row (`QUEUED`) and returns. A
   duplicate `idempotencyKey` inserts nothing and does not send again.
2. `after()` calls `drainEmailQueue()` so a sign-in mail usually leaves
   within that same invocation, without holding the response open. This
   matches `lib/agent/trigger.ts`.
3. `GET /api/cron/email-drain` runs every minute and drains anything
   `after()` did not finish, plus rows whose `nextAttemptAt` is due.
   Vercel Cron's tightest schedule is one minute, which is the retry
   granularity. Transactional rows are claimed before blast rows, and
   each tick caps blast sends (proposal: 25 transactional, then 50
   blast) so a large guest list cannot occupy the function while a
   reset mail waits.
4. Claiming is an `updateMany` from `QUEUED` to `SENDING` conditioned on
   `nextAttemptAt`, the same idea as the inquiry claim. The provider
   call also sends `Idempotency-Key: <idempotencyKey>`. Resend dedupes
   inside its window; the unique column dedupes forever.
5. Backoff on failure: 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours,
   then `FAILED`. Recipient rejections (`EmailFailure === "recipient"`)
   and suppressions do not retry. They record an `EmailEvent` and, for a
   hard bounce, an `EmailSuppression`.

Enqueue is allowed to do the database write inside the request. The
provider call is not.

### Development and preview never deliver

Live delivery only when `VERCEL_ENV === "production"`. Development and
Preview write the row with status `LOGGED`, print the template name and
the recipient to the console, and do not call Resend or SMTP.

Do not log the link or the code. Local development may still return
`devLink` in the HTTP response so the existing flows can be clicked; that
response must not be enabled when `VERCEL_ENV` is `preview` or
`production`. A local Mailpit transport is allowed only when
`EMAIL_CATCHER=1` and the SMTP host is loopback. Preview has neither.

`SITE_URL` in Production should be `https://tryhosty.app`.

### Non-negotiables mapped onto this code

| Rule | Where it lands |
| --- | --- |
| One recipient per message | Keep the current loop. Delete the blast `mailto:?bcc=` fallback in the blast PR |
| Untrusted host content | Blast and inquiry bodies rendered as escaped text inside a shell. Strip tags rather than parsing them |
| No CR/LF in header values | One `stripHeader()` applied to subject, display name, and Reply-To before enqueue |
| Magic links 15 minutes, codes 10 minutes, single use, never logged | New sign-in link kind on `AccountToken` (sha256, same as reset). Email codes copy `PhoneVerification` (bcrypt, 6 digits). High-entropy links stay sha256. 6-digit codes must not be sha256 |
| Verify webhook signatures | Resend signs with Svix. Reject the body if the signature check fails. Dedupe on the provider event id |
| No secrets or other guests' data in the body | Confirmation mail contains that guest's own link and QR. Auth templates' rendered HTML contains a secret: null `textBody` and `htmlBody` after a successful send, and never copy them onto `Activity` or into an API response. The blast action stops returning the recipient address list to the client once sending is reliable; the host already has the guest list |
| Suppression before send | Check `EmailSuppression` at enqueue and again at drain |
| CASL / CAN-SPAM footer | Postal address in the shell of every marketing-shaped message (blasts, club mail). Transactional mail gets the address too; it does not get an unsubscribe that could turn off password reset |

Proposed idempotency keys:

| Template | Key |
| --- | --- |
| Email verification | `verify_email:{accountTokenId}` |
| Password reset | `password_reset:{accountTokenId}` |
| Approval invite | `approval_invite:{accountTokenId}` |
| Sign-in magic link | `sign_in_link:{accountTokenId}` |
| Sign-in or school code | `email_code:{codeRowId}` |
| Welcome | `welcome:{userId}` |
| Email changed | `email_changed:{userId}:{newEmail}:{which}` where `which` is `old` or `new` |
| New device | `new_device:{userId}:{deviceHash}:{hourBucket}` |
| Account deleted | `account_deleted:{userId}` |
| RSVP received | `rsvp_received:{guestId}:{respondedAtEpoch}` |
| Approved / waitlisted / declined | `rsvp_{state}:{guestId}` |
| Promoted | `waitlist_promoted:{guestId}` |
| Confirmation (QR + ics) | `rsvp_confirmed:{guestId}` |
| Reminder | `reminder_{24h\|2h}:{guestId}:{eventStartsAtEpoch}` |
| Event updated | `event_updated:{eventId}:{guestId}:{updatedAtEpoch}` |
| Event cancelled | `event_cancelled:{eventId}:{guestId}` |
| Host RSVP digest | `rsvp_digest:{eventId}:{windowStartEpoch}` |
| Capacity reached | `capacity_reached:{eventId}:{guestCount}` |
| Co-host invite | `cohost_invite:{collaboratorId}` or `{grantId}` once the meaning is chosen |
| Blast copy | `blast:{blastId}:{email}` |
| Product waitlist note | `product_waitlist:{emailListEntryId}:{updatedAtEpoch}` |
| Inquiry | `inquiry:{inquiryId}:{sentAtEpoch}` |
| Agent briefing | `agent_briefing:{eventId}:{day}` |

## 4. Proposed Prisma models

Adapted to this schema: `cuid()` ids, camelCase, relations with explicit
`onDelete`, string `kind` values where the set will grow (same style as
`Notification.kind` and `AccountToken.kind`), enums where the set is closed
(same style as `EventStatus`).

`Blast` stays the blast record. Do not add a second blast table. New
columns are additive so existing rows remain valid (`provider` already
holds `"resend"` or `"manual"`).

```prisma
enum EmailStream {
  TRANSACTIONAL
  BLAST
}

enum EmailMessageStatus {
  QUEUED
  SENDING
  SENT
  FAILED
  SUPPRESSED
  LOGGED
}

/// One outbound message. The unique key is what makes a retry safe.
/// Auth bodies are cleared after a successful send (they contain the link).
model EmailMessage {
  id             String             @id @default(cuid())
  idempotencyKey String             @unique
  stream         EmailStream
  /// "verify_email" | "password_reset" | "rsvp_confirmed" | "blast" | …
  template       String
  toEmail        String
  toName         String?
  fromAddress    String
  replyTo        String?
  subject        String
  textBody       String?
  htmlBody       String?
  /// Provider message id, set once accepted.
  providerId     String?
  status         EmailMessageStatus @default(QUEUED)
  attemptCount   Int                @default(0)
  nextAttemptAt  DateTime           @default(now())
  lastError      String?
  sentAt         DateTime?
  userId         String?
  eventId        String?
  guestId        String?
  blastId        String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  user   User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  event  Event?      @relation(fields: [eventId], references: [id], onDelete: SetNull)
  guest  Guest?      @relation(fields: [guestId], references: [id], onDelete: SetNull)
  blast  Blast?      @relation(fields: [blastId], references: [id], onDelete: SetNull)
  events EmailEvent[]

  @@index([status, nextAttemptAt])
  @@index([toEmail])
  @@index([blastId])
  @@index([eventId])
}

/// A provider callback or a local decision (suppressed, logged).
/// providerEventId dedupes webhook retries.
model EmailEvent {
  id              String   @id @default(cuid())
  emailMessageId  String?
  providerEventId String?  @unique
  /// "accepted" | "delivered" | "bounced" | "complained" | "suppressed" | "logged"
  type            String
  detail          String?
  createdAt       DateTime @default(now())

  message EmailMessage? @relation(fields: [emailMessageId], references: [id], onDelete: SetNull)

  @@index([emailMessageId])
}

/// Hard bounce or complaint. Checked before enqueue and before send.
model EmailSuppression {
  id        String   @id @default(cuid())
  email     String   @unique
  /// "bounce" | "complaint" | "manual"
  reason    String
  detail    String?
  createdAt DateTime @default(now())
}

/// Optional product mail for an account. Password reset, verification,
/// and RSVP outcomes ignore these flags.
model EmailPreference {
  id             String   @id @default(cuid())
  userId         String   @unique
  eventReminders Boolean  @default(true)
  clubUpdates    Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// Host blasts and club mail. One row per address per event. Token RSVP
/// guests have no User, so this is keyed by email, not userId.
model EventEmailUnsubscribe {
  id        String   @id @default(cuid())
  eventId   String
  email     String
  createdAt DateTime @default(now())

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, email])
}
```

Additive columns on the existing `Blast` model:

```prisma
  /// QUEUED while the outbox is draining, SENT when every copy has been
  /// attempted, FAILED if the enqueue itself could not be recorded.
  /// Existing rows were sent (or copied) already; default SENT.
  deliveryStatus       String @default("SENT")
  skippedUnsubscribed  Int    @default(0)
  skippedSuppressed    Int    @default(0)
```

`provider` keeps its string. New writes use `"resend"`, `"manual"`, or
`"logged"`. Stop writing `"resend"` for an SMTP send. Do not rewrite
historical rows.

`User`, `Event`, `Guest`, and `Blast` gain the back-relations above.
`AccountToken.kind` gains documented values `sign_in` (15-minute link)
when magic links are built. School and sign-in **codes** should be a
sibling of `PhoneVerification` (bcrypt, attempts, expiry), not a
sha256 of a 6-digit string. A new `EmailCode` model can wait for that PR;
it does not need to land with the outbox.

`EmailMessage` rows are server-only. Rendered auth bodies are nulled
after `SENT`.

## 5. File-by-file implementation plan

Each block is its own small PR, after this plan is accepted. Order is
load-bearing: the preview/production gate lands before any new template
can send, and the outbox lands before new triggers call the provider
directly.

### PR 1 — Delivery gate and message shape

No new emails. Existing sends keep working in production.

- `lib/email/send.ts` — `canDeliverLive()` is true only when
  `VERCEL_ENV === "production"` and a transport is configured. Otherwise
  log template + recipient and return. Export the stream → From map
  (`mail.` vs `notify.`).
- `lib/email/resend.ts` — accept `html`, `text`, `headers`, and
  `idempotencyKey`. Send `Idempotency-Key`. Keep one address in `to`.
- `lib/email/smtp.ts` — accept `html`. Refuse any host that is not
  loopback unless live delivery is on. This stops a Preview env from
  using the Gmail mailbox.
- `lib/email/headers.ts` — new `stripHeader()`.
- `lib/account.ts` — stop putting the raw link in `console.log`. Keep
  `devLink` only when `VERCEL_ENV` is unset (local). Fix the Resend-only
  wording in `NOT_DELIVERABLE_MESSAGE` and `sendBlockedMessage`.
- `lib/email-list.ts` — same log hygiene.
- `.env.example` — document `VERCEL_ENV` behavior, the two From domains,
  and that Production Gmail SMTP is temporary.
- `tests/unit/email-transport.test.ts`, `tests/unit/account.test.ts`,
  `tests/unit/email-list.test.ts` — cover the gate and header stripping.

### PR 2 — Schema

- `prisma/schema.prisma` — models in section 4, back-relations, `Blast`
  columns.
- `prisma/migrations/<timestamp>_email_outbox/migration.sql` — generated
  locally against a local database only. Never `migrate dev` against the
  hosted URL (`scripts/guard-local-db.mjs` already refuses).
- No callers yet. `vercel-build` applies it only when `VERCEL_ENV` is
  `production`. A preview with this schema change may error until the
  migration lands on `main` and a production build applies it. Merge
  this PR only when Leo expects that production deploy.

### PR 3 — Outbox and drain

- `lib/email/outbox.ts` — `enqueueEmail`, `drainEmailQueue`. Suppression
  check, claim, backoff, redact auth bodies after send. Transactional
  before blast, with the per-tick caps.
- `app/api/cron/email-drain/route.ts` — same `CRON_SECRET` guard as
  `app/api/cron/close-events/route.ts`, `maxDuration` 60.
- `vercel.json` — `{ "path": "/api/cron/email-drain", "schedule": "* * * * *" }`.
- Switch `sendEmails` call sites to `enqueueEmail` plus `after(drain)`:
  `lib/account.ts`, `lib/email-list.ts`, `lib/notify.ts`,
  `lib/blast-send.ts`, `lib/actions/inquiries.ts`,
  `lib/actions/collaborators.ts`. Inquiry/collaborator claims stay; the
  enqueue key makes the provider call safe if the claim and the send
  disagree.
- `lib/blast-send.ts` — set `provider` from the real transport or
  `"logged"`.
- Tests: duplicate key does not double-enqueue; recipient failure does
  not retry; unknown failure sets `nextAttemptAt`; blast rows wait behind
  transactional ones.

Until React Email lands, the HTML part is the plain text escaped into a
minimal shell. That satisfies "every email has HTML and text" without
blocking the queue.

### PR 4 — React Email shells and account templates

Dependency PR: `@react-email/components`, `@react-email/render`.

- `emails/components/shell.tsx` — transactional layout, postal-address
  footer, no unsubscribe.
- `emails/components/blast-shell.tsx` — escaped body, unsubscribe URL,
  `List-Unsubscribe` and `List-Unsubscribe-Post` values returned alongside
  the HTML.
- `emails/verify-email.tsx`, `emails/password-reset.tsx`,
  `emails/approval-invite.tsx`, `emails/welcome.tsx`,
  `emails/product-waitlist.tsx`, `emails/sign-in-link.tsx`,
  `emails/sign-in-code.tsx`, `emails/school-code.tsx`,
  `emails/email-changed.tsx`, `emails/new-device.tsx`,
  `emails/account-deleted.tsx`.
- `lib/email/render.ts` — component in, `{ html, text, subject }` out.
- `lib/account.ts` — enqueue the rendered pair. TTLs for **new** sign-in
  links: 15 minutes. Codes: 10 minutes. Leave the existing 24h verify,
  1h reset, and 7d invite in place until Leo answers the TTL question.
- Wire welcome to the success path of `verifyEmail` with key
  `welcome:{userId}`.
- Sign-in link and sign-in code wait on the product decision in section 8.
  The templates can land dark (no button calls them).

### PR 5 — Event transactional mail

- `lib/email/rsvp.ts` — enqueue helpers used by both the account path and
  the token path. Recipient is `Guest.email`, falling back to
  `User.email`. Skip when both are missing.
- `lib/registration.ts` — guest: RSVP received, and confirmation when the
  result is already attending. Host digest: write a marker rather than
  emailing immediately.
- `lib/actions/guests.ts` `submitRsvpAction` — same guest emails for the
  token page.
- `lib/waitlist.ts` — approved, waitlisted, declined, promoted. Declined
  is new. Send even when `userId` is null.
- `lib/email/reminders.ts` and `app/api/cron/email-reminders/route.ts`
  (or a branch inside the drain cron) — events whose start is inside a
  24h window and a 2h window. Idempotency keys include the start instant
  so a reschedule sends a new reminder. Honor `EmailPreference.eventReminders`.
  Attach PNG QR (`lib/qr.ts` / `qrcode`) and `.ics` (`lib/calendar.ts`)
  on the confirmation, not on the reminder.
- Event update and cancel: hook the server action that writes `Event`
  (find it in `lib/actions/` when implementing; do not email on every
  autosave). Material fields proposal: `date`, `durationHours`, `city`,
  `address`, `title`, and status moving to `CANCELLED`.
- Capacity: when an attending insert makes `attendingHeads >= guestCount`, enqueue
  one host mail. Key includes `guestCount`, so raising the cap can notify
  again.
- Host digest: flush pending `registration_request` notifications older
  than 15 minutes inside the drain. One email per host per event per
  window. Keep the Inbox rows as they are.
- Tests next to `tests/unit/waitlist-approval.test.ts` and
  `tests/unit/registration.test.ts`.

### PR 6 — Blasts, preferences, unsubscribe

- `lib/blast-send.ts` — enqueue one `EmailMessage` per recipient on stream
  `BLAST`, skip `EventEmailUnsubscribe` and `EmailSuppression`, record the
  skip counts, rate-limit with `lib/rate-limit.ts` (proposal: 3 blasts per
  event per 24h and 10 per host per 24h).
- `lib/blasts.ts` — unchanged segment rules.
- `components/blast-composer.tsx` — show the segment count and a preview
  of the escaped body with `{name}` filled for a sample guest. Remove the
  BCC `mailto:`. Keep "copy the message" for the manual/logged case.
  Stop returning every address in the action result once `deliveryStatus`
  is `QUEUED`.
- `app/unsubscribe/[token]/page.tsx` — token is a signed guest+event id
  (new helper next to `lib/tokens.ts`), not the raw `rsvpToken` (that token
  is already the RSVP credential; do not overload it).
- `app/(app)/settings/page.tsx` and `lib/actions/profile.ts` — toggles for
  `eventReminders` and `clubUpdates`, beside the existing guest-list toggle.
  `app/api/v1/me` gets the same fields so iOS can follow later. iOS UI is
  out of these PRs.
- `lib/notify.ts` — `club_update` and `club_published` enqueue on the blast
  stream and honor `clubUpdates` plus per-event unsubscribe. `blast` stays
  Inbox/push only (the email already went).
- List-Unsubscribe headers on blast-stream messages only.

### PR 7 — Webhooks and suppression

- `app/api/webhooks/resend/route.ts` — read the raw body, verify the Svix
  signature with `RESEND_WEBHOOK_SECRET`, then write `EmailEvent`. On
  `email.bounced` (hard) and `email.complained`, upsert
  `EmailSuppression`. Unknown signatures return 401 and write nothing.
- Dedupe on `providerEventId`.
- A suppressed address fails enqueue with status `SUPPRESSED` and no
  provider call.
- Tests with a fixed signature fixture. Do not log the payload if it
  echoes a message body.

### PR 8 — Account edges that need product decisions

Build only the items Leo confirms in section 8.

- School code: new `EmailCode` (or a generalized `PhoneVerification`),
  10-minute bcrypt code, sent when the account claims a school domain that
  was not proven by the verified login address. `lib/schools.ts` stays the
  domain→school map.
- Email change: new action. Mail the old address (notice, no credential
  link) and the new address (verify link). `User.email` changes only after
  the new link is consumed.
- New device: store a hash of user-agent family on the account. Mail on
  first sight. The mail links to `/forgot-password`; it does not contain a
  pre-issued reset token.
- Account deleted: enqueue from the deletion transaction, to the address
  captured before the row is removed. The deletion feature itself is still
  unbuilt; this template waits for it.
- Magic-link or email-code sign-in: new credentials-adjacent route, rate
  limited like `LIMITS.forgot`. Session issuance stays in `lib/auth.ts` /
  `lib/api/token.ts` after the token is consumed. Passwords keep working.

### Explicitly untouched

`ios/`, SMS (`lib/sms/`), APNs (`lib/push/`), MCP, campus sync, and the
agent's model calls. `package.json` changes only in PR 4.

## 6. Manual steps for Leo

Do these yourself. The implementation PRs should not embed secrets or
click through DNS.

1. **Confirm Production env.** In the Vercel project `hosty`, list
   Production and Preview. Expect some of `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Note whether `RESEND_API_KEY`
   and `RESEND_FROM` are also set. If both sets are present, Production is
   on Resend today, and an unverified domain would explain signup mail
   that only arrives for the Resend account owner.
2. **Choose the provider** if you disagree with Resend (section 8). If you
   agree, create the Resend account (or open the existing one) and add two
   domains: `mail.tryhosty.app` and `notify.tryhosty.app`.
3. **DNS** at the registrar for `tryhosty.app`, for each subdomain: the
   DKIM records Resend shows, SPF that includes Resend's include, and a
   DMARC record on `_dmarc.tryhosty.app`. Start DMARC at `p=none` with an
   aggregate mailbox you read, then move to `p=quarantine` and `p=reject`
   after legitimate mail is aligned. Do not put the Gmail mailbox's SPF
   on these subdomains once Gmail is retired.
4. **Prove delivery** to an address that is not the Resend owner's, from
   each subdomain, before flipping Production.
5. **Production env, after the proof:** `RESEND_API_KEY`,
   `RESEND_FROM` (transactional From, for the period when only one From
   exists in code — PR 1 introduces the pair), `RESEND_FROM_BLAST` (name
   to match the code when PR 1 lands), `RESEND_WEBHOOK_SECRET`,
   `SITE_URL=https://tryhosty.app`. Set the API key on Production only.
   Leave Preview and Development without it.
6. **Remove Production `SMTP_*`** after the proof send, so a later Resend
   outage is fixed by repairing Resend rather than silently sharing
   reputation with Gmail. Keep SMTP on your laptop only if you run Mailpit.
7. **Webhook.** Resend → webhook endpoint
   `https://tryhosty.app/api/webhooks/resend` for `email.bounced` and
   `email.complained` (delivered too, if you want the event row). Copy the
   signing secret to `RESEND_WEBHOOK_SECRET`. Add the route's URL only
   after PR 7 is deployed, or Resend will retry 404s.
8. **Cron.** `CRON_SECRET` must already be set for the other jobs. The
   one-minute drain in PR 3 needs a Vercel plan that allows minute crons.
   Confirm the plan before merging PR 3; on a plan that only runs daily
   crons, `after()` still sends the first attempt and retries wait until
   the next daily run.
9. **Postal address** for the CAN-SPAM / CASL footer. A real street
   address. It will be visible in every blast and club email.
10. **Migration.** PR 2's SQL is applied by `vercel-build` on the next
    production deploy only (`VERCEL_ENV=production`). Preview builds skip
    migrate and seed. A preview with this schema change may error until
    the migration lands on `main`. Read the SQL before you let that
    production deploy run. If a migrate fails halfway, follow the P3009
    steps already in `docs/backend.md`. Do not point `npm run db:migrate`
    at the hosted database.
11. **Auth.js.** There is no provider SMTP form to fill in. Optional only:
    if you later insist on SMTP, Resend's host is `smtp.resend.com`, user
    `resend`, password the API key, From on the verified domain. The plan
    uses the API instead.
12. **Gmail app password.** After cutover, revoke the app password that
    was in `SMTP_PASSWORD` if it was a personal Gmail account.

## 7. Out-of-scope follow-ups

In the order to pick them up after launch mail is reliable:

1. **Guest invitation email** when a host adds someone or invites from the
   guest book. Today the host copies `/rsvp/[token]`. Not in the launch
   list, and it is the obvious hole next to "RSVP received".
2. **Self-serve account deletion and export**, which `docs/backend.md`
   already lists as unbuilt. The "account deleted" template has nothing
   to call it until this exists. App Store review is the forcing function.
3. **Marketing / newsletter** (a product list that is not a host blast and
   not the invite waitlist). Separate domain again if it ever exists.
4. **Open and click dashboards.** Requires tracking pixels and rewritten
   links, which fight the "no remote images / no extra secrets in the
   body" rules. Skip until someone asks for them in a host-facing UI.
5. **SMS and push as a unified notification preference.** Both already
   send. Leave them on their own paths.
6. **Localization** of templates.
7. **A/B testing** of subjects or bodies.
8. **Co-host as a real permission** (manage this event without owning it),
   if the invitation in the launch list is meant to grant access. Today
   `EventCollaborator` does not.

## 8. Open questions

1. **Resend or Postmark?** This plan keeps Resend and uses two subdomains
   because the client is already written. Say if you want Postmark streams
   instead, before PR 1.
2. **Is Production on Gmail SMTP, Resend, or both right now?** The dashboard
   was not readable from this session. Both-set means Resend is live.
3. **Sign-in: magic link, 6-digit code, or both, beside the password?**
   Passwords are real and should keep working. Recommendation: a 15-minute
   magic link as an additional sign-in, codes only for school verification,
   matching the phone-code UX people already have for SMS.
4. **TTLs for the links that already exist.** Reset is 1 hour, address
   verification is 24 hours, approval invite is 7 days. The 15-minute rule
   is for session-granting links. Recommendation: move password reset to
   15 minutes; leave address verification at 24 hours (it does not by
   itself start a session); shorten the approval invite from 7 days to
   something you will actually tolerate a leaked inbox for (proposal: 48
   hours, then Forgot password).
5. **School verification.** Is it a code to a second address, or a code
   only when the login email is not already the `.edu` being claimed?
   Profile can change school today with no proof.
6. **What is a co-host invitation?** The outreach email to a
   `COHOST` contact, or a new "you can manage this event" grant? They are
   different products. Section 5 PR 8 waits on this.
7. **Which event edits are worth an "updated" email?** Proposal: date,
   duration, city, address, title, cancellation. Not vibe, budget, or
   cover image.
8. **Host RSVP digest delay.** Proposal: 15 minutes, one mail per event,
   transactional stream. Inbox notifications stay immediate.
9. **Blast rate numbers.** Proposal: 3 per event per 24 hours, 10 per host
   per 24 hours, worker cap 50 blast messages per minute after
   transactional mail. Say if a launch night needs more.
10. **Club updates and "club published".** They are live and they share
    the auth transport. Plan: blast stream, unsubscribe honored. Confirm
    you want followers to be able to mute a club's email without leaving
    the club.
11. **Postal address** to print in the footer, and whether you have
    Canadian recipients that make CASL's identification rules mandatory
    on the first blast (the footer covers both if the address is real).
12. **Minute cron.** Confirm the Vercel plan allows `* * * * *`. If it
    does not, PR 3 still ships `after()` and a coarser schedule, and
    retries get slower.
13. **Preview shares the production database.** Any test of a real send
    from a preview deployment is a production send. The gate in PR 1
    forbids that. Confirm you do not want a "send previews to me only"
    exception. The brief says preview never sends to a real address.
14. **Redact auth bodies after send.** Recommendation is yes. The
    idempotency row remains; the link does not sit in `EmailMessage`
    until the row is cleaned up by age.
