# Hosty backend

What holds the data, images and accounts, what's live today, and what still
needs a key from you. Hosty's backend is the Next.js app itself: every
`/api/v1` route and server action runs on Vercel functions against one
Postgres database. There is no second service to deploy.

## The pieces

| Concern | Where it lives | Status |
| --- | --- | --- |
| **Data** | Postgres via Prisma 7 (`prisma/schema.prisma`, migrations in `prisma/migrations`). On Vercel: the Storage-attached Prisma Postgres / Neon (`DATABASE_URL`, `DIRECT_URL`). `vercel-build` runs `prisma migrate deploy` on every deploy. | **Live** |
| **Accounts** | Email + password. Web: Auth.js credentials with JWT sessions (`lib/auth.ts`). App: 30-day HMAC bearer tokens (`lib/api/token.ts`). Passwords bcrypt-hashed; sign-in takes the same time for unknown emails. Administrators are the addresses in `ADMIN_EMAILS` (comma-separated, trimmed, case-insensitive). Unset means nobody is an administrator. | **Live** |
| **Account recovery** | Password reset by one-time link (`lib/account.ts`, `/forgot-password`, `/reset-password`, `POST /api/v1/auth/forgot` + `/reset`). Tokens stored hashed, one hour, single use. A waitlist approval (`/admin/waitlist`) sends the same kind of link as a set-password invite, good for a week. | **Live**; needs Resend to actually email |
| **Email verification** | A link on sign-up and on demand (`/verify-email?token=`, `POST /api/v1/auth/verify`); `User.emailVerifiedAt`; a nudge on the profile until confirmed. Students' `.edu` school stays a claim until this is set. | **Live**; needs Resend to actually email |
| **Abuse limits** | Fixed-window counters in Postgres (`lib/rate-limit.ts`): sign-in 10/15 min per email and 30 per address, sign-up 10/hour per address, reset links 3/hour per email, verification resends 3/hour. | **Live** |
| **Images** | `lib/images.ts`: profile pictures, event covers, club pictures. Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set; otherwise bytes go into the `Image` table and out through `/api/images/:id`. | Works either way; **Blob recommended** for production |
| **Email** | Resend (`lib/email/resend.ts`) or SMTP (`lib/email/smtp.ts`): blasts, approvals, promotions, club posts and updates, resets, verification. Resend wins if both are set. Target design: [email system plan](email-system-plan.md). | Live only when `VERCEL_ENV=production` and a transport is configured |
| **SMS** | Twilio (`lib/sms`): phone verification codes, SMS blasts. Without Twilio, development logs a masked number and the code. Production (`NODE_ENV=production` or `VERCEL_ENV=production`) refuses to send and does not log the number or the code. | Needs `TWILIO_*` |
| **Push** | APNs (`lib/push/apns.ts`). | Needs a paid Apple team + `APNS_*` |
| **Campus sync** | Daily cron (`vercel.json` → `/api/cron/campus-sync`) plus on-demand refresh. | Needs `CRON_SECRET` for the schedule |
| **Venue search (web)** | Google Places API (New) Text Search, or Apple Maps Server API if Google isn't configured. | Needs `GOOGLE_MAPS_API_KEY` or `APPLE_MAPS_*` |

## What to set in Vercel, in order of impact

1. **`ADMIN_EMAILS`** — comma-separated administrator addresses for `/admin`. Set it on Production and Preview. If it is missing, nobody is an administrator. The seed's admin account is the first address in the list, and `HOSTY_ADMIN_PASSWORD` is still that account's password. With `ADMIN_EMAILS` unset the seed skips the admin account.
2. **`RESEND_API_KEY`, `RESEND_FROM`** — turns on every email in production: password resets, verification, approvals, club updates. Set them on Production only. Preview and a laptop log the template name and the recipient, never the link. A laptop (no `VERCEL_ENV`) still returns the link to the client so the flow can be clicked.
3. **`BLOB_READ_WRITE_TOKEN`** — Vercel → Storage → Blob. Moves uploads out of Postgres onto a CDN. Existing rows keep serving from `/api/images/:id`.
4. **`CRON_SECRET`** — any random string; Vercel sends it on the scheduled campus sync.
5. **`DIRECT_URL`** — the provider's non-pooled URL so `prisma migrate deploy` doesn't go through the pooler.
6. `TWILIO_*`, `GOOGLE_MAPS_API_KEY` (or `APPLE_MAPS_*`), `APNS_*` — when you want texts, web venue search and push.

## Enabling web venue search

The Create form searches real places around the selected city. iOS does this
on-device with MapKit; the website needs a server key.

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project → enable billing.
2. APIs & Services → Library → enable **Places API (New)** (not only the legacy Places API).
3. APIs & Services → Credentials → Create credentials → API key. Restrict it to Places API (New).
4. Set `GOOGLE_MAPS_API_KEY` on the Vercel project (Production, Preview, Development) and redeploy.
5. `/api/v1/venues/search` then returns venues with `unavailable: false`.

Places SKUs have a monthly free usage cap (this replaced the old $200 credit).
Phone and website on a result use Text Search Enterprise; name, address and
coordinates are Pro. If Google isn't set, `APPLE_MAPS_TEAM_ID` /
`APPLE_MAPS_KEY_ID` / `APPLE_MAPS_PRIVATE_KEY` are the fallback. Without either
key the form offers typing an address (`unavailable: true`).

## Data safety

- **Backups.** Prisma Postgres and Neon both keep point-in-time history on the dashboard; turn on the longest retention your plan allows. There is no app-level backup job.
- **Migrations** are forward-only and applied on deploy. Never edit an applied migration; add a new one (`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`).
- **Deleting an account** cascades through events, registrations, follows, tokens and notifications by schema. There is no self-serve delete yet — see below.
- **Never point `migrate dev` at the hosted database.** It authors migrations and offers to drop the database when it has drifted; a half-applied run leaves a failed row in `_prisma_migrations` and then *every* deploy fails. `npm run db:migrate` and `db:reset` now refuse a non-local `DATABASE_URL` (`scripts/guard-local-db.mjs`); `ALLOW_REMOTE_MIGRATE=1` overrides it deliberately. `npm run db:deploy` is the safe one — it only applies migrations that already exist.

### When a deploy fails with P3009

`migrate found failed migrations in the target database` means a previous
run died partway and left its row behind; nothing new will apply until that
row is cleared. Find the named migration, decide whether its statements
actually landed, and tell Prisma:

```bash
# with DATABASE_URL pointing at the hosted database
npx prisma migrate resolve --rolled-back <migration_name>   # it did not apply
npx prisma migrate resolve --applied     <migration_name>   # it did apply
```

Then redeploy. A migration named in the error but **absent from
`prisma/migrations/`** was authored by a stray `migrate dev` against
production — that one is always `--rolled-back`.

## Not built yet

- **Self-serve account deletion and data export** (needed for App Store review).
- **OAuth sign-in** (Apple, Google). The credentials model is fine for now; adding a provider is an Auth.js config change plus a token exchange for the app.
- **A list of individual devices.** Bearer tokens (the iOS app and the Cursor MCP token) can be cut off together from Settings → Revoke agent access, without a password reset and without a schema change: the cutoff is an `AccountToken` row of kind `agent-revoke`. A password reset still bumps `sessionVersion` and ends web sessions, bearer tokens, and OAuth grants. The browser stays signed in when only agent access is revoked. The iOS app uses the same bearer, so it has to sign in again.
- **Object-level authorization tests** on every route. The permission helpers exist (`manageableEvent`, `canManageClub`); a review pass with the smoke scripts under `tests/e2e` would harden them.
