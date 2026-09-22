# Vendor Outreach: Send and Chase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Hosty send a vendor inquiry itself — the host approves each message, Hosty delivers it, records that it went, and afterwards says who has not replied.

**Architecture:** The vendor pipeline already exists end to end (`SavedListing` → `Inquiry` → `BudgetItem` → coverage) but is entirely manual: Hosty drafts a message, the host copies it into their own mail client, and hand-updates the status. This plan closes that loop using machinery already in the repo — `lib/email/send.ts` for delivery and the existing `InquiryStatus` state machine — plus one nullable column for a recipient address. Every rule lands in a pure `lib/` function with unit tests; the server action stays thin.

**Tech Stack:** TypeScript, Next.js 16 (App Router, server actions), Prisma 7, Vitest, Zod, Resend/SMTP via the existing transport.

**Spec:** No separate spec document. This plan is derived from the problem statement — *"hosting a proper event requires outreach to speakers, security, venues and catering; startups, SMBs and resource-limited companies lack the capacity to plan and execute events for hundreds of people"* — narrowed by three decisions the product owner made on 2026-09-19:

1. **Audience: pivot to companies/SMBs.** Campus-specific machinery becomes legacy; vendor sourcing and execution become the product. This plan is deliberately audience-neutral — it touches nothing school-shaped.
2. **First slice: close the outreach loop.** Chosen over adding vendor categories or building a supply side.
3. **Autonomy: the host approves each message before it sends.** This extends the principle recorded in PR #51 ("drafts only, a human presses every button") to vendor email. **No batch send. No automatic follow-up.**

## What the codebase already has, verified

Do not rebuild any of this:

- `lib/outreach.ts:153` — `composeInquiry(event, target, hostName): { subject, body }`, with per-category questions for `VENUE`, `CATERING` and others, and per-role questions for collaborator kinds including speakers. It deliberately never mentions the budget.
- `lib/actions/inquiries.ts:27` — `startInquiryAction` creates the `Inquiry` with the drafted body, idempotent per `(eventId, listingId)`.
- `lib/actions/inquiries.ts:66` — `updateInquiryAction` moves status along and, on `BOOKED`, writes back into the budget and closes the matching task.
- `lib/email/send.ts:37` — `sendEmails(emails: OutgoingEmail[]): Promise<number>`, picking Resend or SMTP; `isEmailConfigured()` at `:26`.
- `lib/email/resend.ts:21` — `OutgoingEmail = { to: string; subject: string; text: string; replyTo?: string }`. **`replyTo` already exists**, which is what makes this plan cheap.
- `lib/email/failure.ts` — `EmailSendError` and `classifyEmailFailure`, the established way this repo explains a failed send instead of swallowing it.
- `components/inquiry-panel.tsx` — the per-inquiry UI: an editable message textarea, a `mailto:` link, a status select and a quoted-price field.

## The gap this plan closes, precisely

`Listing` has **no contact email, phone or website** (`prisma/schema.prisma:473-502`). There is nowhere to send an inquiry, which is why `lib/outreach.ts:188` builds `mailto:?subject=…` with **no recipient** — the host types the address into their own mail client every time.

So the recipient has to come from the host. That is honest: Hosty has no supply side, and this plan does not pretend otherwise. What it removes is the part that actually costs capacity — copying the message, remembering to send it, and hand-tracking who replied.

## Deliberately NOT in this plan

- **Inbound email.** Hosty cannot see a vendor's reply without inbound-mail infrastructure (a Resend inbound webhook or an IMAP poller). Instead, `replyTo` is set to the **host's own address**, so replies land in the host's normal inbox. `REPLIED`, `QUOTED` and `BOOKED` stay manual, exactly as today. Automatic reply threading is a separate project.
- **A `SECURITY` vendor category.** `ListingCategory` has 14 values and `SECURITY` is not among them (`STAFFING` is the nearest). Speakers are already reachable through `CollaboratorKind`, which `composeInquiry` handles. Adding `SECURITY` is a small separate change and was not the chosen slice.
- **Batch send, automatic chasing, or any send the host did not individually approve.** Decision 3 above.

## Global Constraints

- Node `>=20.19.0` (`package.json` engines).
- **Server actions and page/form components are not unit tested in this repo.** Every file in `tests/unit/` targets a pure `lib/` module. There is no database mock and no React test harness — **do not add one**. Rules go in pure functions; those get the tests. Actions and UI are covered by `npm run lint`, `npm run typecheck` and the Playwright suite.
- **Never send mail without `isEmailConfigured()` returning true**, and never swallow a send failure — use `classifyEmailFailure` and return a message, following `lib/email/failure.ts`.
- **Never send without the host's explicit per-message approval.** One click, one message, one recipient.
- **Never put the budget in a vendor message.** `lib/outreach.ts:15-17`: "Telling a vendor what you have to spend is how it becomes what you spend."
- **Migrations:** this plan adds one, **hand-written and applied with `prisma migrate deploy`** — see Task 1 Step 6 for why `migrate dev` cannot be used in this checkout. Never set `ALLOW_REMOTE_MIGRATE=1`; `scripts/guard-local-db.mjs` exists because a `migrate dev` against hosted Postgres once left a half-applied migration that failed every deploy with P3009. Production applies migrations automatically: `vercel-build` runs `prisma migrate deploy` before `next build`, so a hand-written file ships the same way a generated one would, and CI validates it against a throwaway database.
- The new column must be **nullable** — existing `Inquiry` rows have no recipient and must keep working.
- No new npm dependencies.
- Commit messages: imperative, sentence case, **no** `feat:`/`fix:` prefix — match `git log`. End each commit message with:
  `Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa`
- Verification: `npm run lint`, `npm run typecheck`, `npm test`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify (`Inquiry`, ~line 533) | Adds nullable `toEmail`. |
| `prisma/migrations/<generated>_inquiry_recipient/` | Create (hand-written) | One `ALTER TABLE … ADD COLUMN`. |
| `lib/outreach.ts` | Modify (append) | Gains pure `normalizeRecipient` and `inquiryEmail`. |
| `tests/unit/outreach.test.ts` | Modify (append) | Covers both, including the reply-to rule. |
| `lib/actions/inquiries.ts` | Modify (`updateSchema` ~line 52; append a new action) | Stores the recipient; `sendInquiryAction` delivers it. |
| `components/inquiry-panel.tsx` | Modify | Recipient input; Send button; failure message. |
| `lib/chase.ts` | Create | Pure: which sent inquiries have gone quiet. |
| `tests/unit/chase.test.ts` | Create | Covers the boundary and the exclusions. |
| `app/(app)/events/[id]/shortlist/page.tsx` | Modify | Renders the chase line. |

Task 1 must land before Task 2 (the send needs a recipient column). Task 3 is independent of both and could run first, but the steps below put it last so the chase list describes a loop that actually sends.

---

### Task 1: Give an inquiry a recipient

**Files:**
- Modify: `prisma/schema.prisma` — the `Inquiry` model, which begins at line 533
- Create: `prisma/migrations/<generated>_inquiry_recipient/migration.sql` (hand-written — see Task 1 Step 6)
- Modify: `lib/outreach.ts` (append)
- Test: `tests/unit/outreach.test.ts` (append)
- Modify: `lib/actions/inquiries.ts` — `updateSchema` at line 52 and the `db.inquiry.update` call inside `updateInquiryAction`
- Modify: `components/inquiry-panel.tsx`

**Interfaces:**
- Consumes: `Inquiry` model fields `id, eventId, listingId, status, message, quotedCents, sentAt, respondedAt` (`prisma/schema.prisma:533-551`); `updateInquiryAction(_prev: InquiryFormState, formData: FormData): Promise<InquiryFormState>` where `InquiryFormState = { error?: string } | undefined` (`lib/actions/inquiries.ts:11`).
- Produces: `Inquiry.toEmail: string | null`; `normalizeRecipient(raw: string | null | undefined): string | null` exported from `lib/outreach.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/outreach.test.ts`. Add `normalizeRecipient` to the existing `@/lib/outreach` import at the top of the file.

```ts
describe("the vendor's address", () => {
  it("trims and lowercases, so the same inbox isn't stored two ways", () => {
    expect(normalizeRecipient("  Events@Venue.COM ")).toBe("events@venue.com");
  });

  // An unsendable address must not be stored as if it were sendable: the send
  // button keys off this field being present.
  it("rejects anything that isn't an address", () => {
    expect(normalizeRecipient("not an email")).toBeNull();
    expect(normalizeRecipient("@venue.com")).toBeNull();
    expect(normalizeRecipient("events@")).toBeNull();
  });

  it("treats blank and missing as no address, not as an error", () => {
    expect(normalizeRecipient("")).toBeNull();
    expect(normalizeRecipient("   ")).toBeNull();
    expect(normalizeRecipient(null)).toBeNull();
    expect(normalizeRecipient(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/outreach.test.ts`
Expected: FAIL — `normalizeRecipient is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/outreach.ts`:

```ts
/**
 * The vendor's address, or null when there isn't a usable one.
 *
 * Null rather than throwing because "no address yet" is the normal state of a
 * draft — the host often writes the message before they have found who to
 * send it to. Whether an inquiry can be sent is exactly whether this returns
 * a string.
 */
export function normalizeRecipient(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  return z.string().email().safeParse(trimmed).success ? trimmed : null;
}
```

`lib/outreach.ts` does not currently import zod — its only imports are the enum types and `EVENT_TYPE_LABEL` — so add it at the top:

```ts
import { z } from "zod";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/outreach.test.ts`
Expected: PASS, including the pre-existing `composeInquiry` cases.

- [ ] **Step 5: Add the column to the schema**

In `prisma/schema.prisma`, inside the `Inquiry` model, add `toEmail` directly beneath `message`:

```prisma
  /// Where the inquiry goes. Null until the host finds the vendor's address —
  /// Listing carries no contact details, because there is no supply side.
  toEmail     String?
```

- [ ] **Step 6: Write the migration by hand, and apply it with `migrate deploy`**

**Do not run `prisma migrate dev`.** This checkout's local database carries pre-existing drift that has nothing to do with this task: `_prisma_migrations` holds 21 rows against 20 migration folders, the orphan being `20260914120000_tickets`, and the database still has `Order`, `Ticket` and `TicketTier` tables that no current migration creates. They are residue from PRs #36 and #37, both of which were **closed, never merged**, so production never received them.

`migrate dev` diffs the real schema against a shadow database, sees those three tables, calls it drift, and offers to **drop and recreate the database** — which would destroy roughly 42,000 local `CampusEvent` rows. `migrate deploy` performs no such comparison: it simply applies migration folders that are not yet recorded. So the migration gets written by hand and deployed.

Create `prisma/migrations/20260919130000_inquiry_recipient/migration.sql` containing exactly:

```sql
-- Where an inquiry goes. Null until the host finds the address: Listing holds
-- no contact details, because Hosty has no supply side.
ALTER TABLE "Inquiry" ADD COLUMN "toEmail" TEXT;
```

The timestamp must sort after the current newest folder, `20260919120000_campus_event_types` — `20260919130000` does.

Then run: `npx prisma migrate deploy`

Expected: `1 migration found` and `Applying migration 20260919130000_inquiry_recipient`, with no prompt of any kind. If it instead reports a failed migration (P3009) or a checksum mismatch, stop and report BLOCKED — do not attempt a repair.

Then run: `npx prisma generate`

Expected: clean. This regenerates the client so `Inquiry.toEmail` is typed; `migrate deploy` does not regenerate on its own the way `migrate dev` does.

Finally, confirm the column actually landed: `npx prisma migrate status`
Expected: `21 migrations found` and `Database schema is up to date!`

- [ ] **Step 7: Accept the recipient in the update action**

In `lib/actions/inquiries.ts`, extend `updateSchema` (line 52):

```ts
const updateSchema = z.object({
  status: z.enum(STATUSES as [string, ...string[]]),
  quoted: z.string().optional(),
  message: z.string().max(8000).optional(),
  toEmail: z.string().max(320).optional(),
});
```

Add `toEmail: formData.get("toEmail")` to the object passed to `updateSchema.safeParse(...)`, alongside the existing `status`, `quoted` and `message` entries.

Then, in the `db.inquiry.update` call inside `updateInquiryAction`, include the normalized address in the `data` object — but **only when the form actually carried the field**:

```ts
      ...(formData.has("toEmail")
        ? { toEmail: normalizeRecipient(parsed.data.toEmail) }
        : {}),
```

The `formData.has` guard is load-bearing, not defensive noise. `normalizeRecipient(undefined)` returns `null`, so writing the key unconditionally would mean any future form that posts to this action without a `toEmail` input silently erases a stored address. Spreading the key in only when it was submitted makes an absent field mean "leave it alone" and an empty field mean "clear it" — which is what the host expects from each.

Import it at the top of the file, extending the existing `@/lib/outreach` import:

```ts
import { composeInquiry, normalizeRecipient } from "@/lib/outreach";
```

Note this means clearing the field clears the stored address, which is the behaviour you want: a host who realises they had the wrong address deletes it, and the Send button goes away.

- [ ] **Step 8: Put the field in the panel**

In `components/inquiry-panel.tsx`, inside the same form that already carries `name="message"` and `name="status"`, add a recipient input above the message textarea. Locate it by searching for `name="message"`; do not trust line numbers.

```tsx
        <label className="block">
          <span className="text-[13px] font-medium text-ink-soft">Their email</span>
          <input
            type="email"
            name="toEmail"
            defaultValue={inquiry.toEmail ?? ""}
            placeholder="events@venue.com"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink"
          />
        </label>
```

Leave the existing `mailto:` link in place — a host who prefers their own mail client keeps that route.

- [ ] **Step 9: Verify**

Run: `npm run typecheck`
Expected: PASS. `npx prisma generate` runs on `postinstall`, but the migration step already regenerated the client; if `Inquiry.toEmail` is not recognised, run `npx prisma generate` and re-run.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/outreach.ts tests/unit/outreach.test.ts lib/actions/inquiries.ts components/inquiry-panel.tsx
git commit -m "$(cat <<'EOF'
Give an inquiry somewhere to go

Listing carries no contact details — there is no supply side — so the
address has to come from the host. Null until they have it, which is also
what decides whether the inquiry can be sent at all.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

### Task 2: Send it, on the host's click

**Files:**
- Modify: `lib/outreach.ts` (append)
- Test: `tests/unit/outreach.test.ts` (append)
- Modify: `lib/actions/inquiries.ts` (append a new action)
- Modify: `components/inquiry-panel.tsx`

**Interfaces:**
- Consumes: `normalizeRecipient` and `composeInquiry(event, target, hostName): { subject, body }` from Task 1 and `lib/outreach.ts:153`; `sendEmails(emails: OutgoingEmail[]): Promise<number>` and `isEmailConfigured(): boolean` from `@/lib/email/send`; `OutgoingEmail = { to: string; subject: string; text: string; replyTo?: string }`; `EmailSendError` and `classifyEmailFailure` from `@/lib/email/failure`; `requireEvent(eventId)` returning `{ user, event }` where `user` is `{ id, email, name } | null` (`lib/session.ts:85`).
- Produces: `inquiryEmail(args): OutgoingEmail` exported from `lib/outreach.ts`; `sendInquiryAction(_prev: InquiryFormState, formData: FormData): Promise<InquiryFormState>` exported from `lib/actions/inquiries.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/outreach.test.ts`. Add `inquiryEmail` to the existing `@/lib/outreach` import.

```ts
describe("the email an inquiry becomes", () => {
  const args = {
    to: "events@venue.com",
    subject: "Mixer inquiry — 12 March, 300 guests",
    message: "Hello Venue,\n\nWe are planning a mixer.\n\nThanks,\nSam",
    hostEmail: "sam@startup.com",
  };

  it("sends to the vendor and replies to the host", () => {
    const email = inquiryEmail(args);

    expect(email.to).toBe("events@venue.com");
    // The whole reply-handling design rests on this: Hosty cannot read a
    // vendor's reply, so the reply must go straight to a human who can.
    expect(email.replyTo).toBe("sam@startup.com");
  });

  it("sends the host's own words, not a re-drafted message", () => {
    const email = inquiryEmail(args);

    expect(email.text).toBe(args.message);
    expect(email.subject).toBe(args.subject);
  });

  it("omits replyTo rather than inventing one when the host has no address", () => {
    const email = inquiryEmail({ ...args, hostEmail: null });

    expect(email.replyTo).toBeUndefined();
    expect(email.to).toBe("events@venue.com");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/outreach.test.ts`
Expected: FAIL — `inquiryEmail is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/outreach.ts`:

```ts
/**
 * The inquiry as a sendable email.
 *
 * `text` is whatever the host last saved, not a fresh draft: they are allowed
 * to rewrite the message, and sending something other than what they approved
 * would make the approval meaningless.
 *
 * `replyTo` is the host, never Hosty. Nothing here can read an inbox, so a
 * reply that came back to the sending address would be lost — it has to reach
 * the person who can answer it.
 */
export function inquiryEmail(args: {
  to: string;
  subject: string;
  message: string;
  hostEmail: string | null;
}): OutgoingEmail {
  return {
    to: args.to,
    subject: args.subject,
    text: args.message,
    ...(args.hostEmail ? { replyTo: args.hostEmail } : {}),
  };
}
```

Add the type import at the top of `lib/outreach.ts`:

```ts
import type { OutgoingEmail } from "@/lib/email/send";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/outreach.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the send action**

Append to `lib/actions/inquiries.ts`:

```ts
/**
 * Sends one inquiry, because the host pressed send on that one message.
 *
 * Deliberately not a batch: these are real businesses receiving mail with a
 * host's name on it, and the approval is per message. Only a DRAFT can be
 * sent, so a double-click cannot mail a vendor twice.
 */
export async function sendInquiryAction(
  _prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const { event, user } = await requireEvent(eventId);

  // requireEvent admits a signed-out visitor holding a draft-claim cookie
  // (lib/session.ts:67). Every other outbound-email path refuses that — see
  // sendBlastAction — and this one chooses both recipient and body, so it
  // refuses harder: an anonymous send would leave from Hosty's own domain
  // with no reply address on it.
  if (!user?.email) {
    return { error: "Sign in before sending this." };
  }

  try {
    await assertRateLimit(`outreach:${user.id}`, ...LIMITS.outreach.perActor);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }

  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet, so nothing can be sent from here." };
  }

  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, eventId },
    include: { listing: true },
  });
  if (!inquiry) return { error: "That inquiry is no longer here." };

  const to = normalizeRecipient(inquiry.toEmail);
  if (!to) return { error: "Add the vendor's email address first." };

  if (inquiry.status !== "DRAFT") {
    // Cheap pre-check for a better message in the common case. It does not
    // enforce the rule by itself — two near-simultaneous requests can both
    // pass it — the claim below is what actually stops a double send.
    return { error: "That inquiry has already been sent." };
  }

  const { subject } = composeInquiry(event, inquiry.listing, user.name ?? "the host");

  // A row can legitimately be DRAFT with a sentAt already on it (send, then
  // set status back to Draft — updateInquiryAction never clears the
  // timestamp). Capture it before the claim so a failed re-send restores the
  // original value instead of erasing history that goneQuiet reads.
  const previousSentAt = inquiry.sentAt;

  // Claim the row before sending, not after: two tabs (or a fast double-click
  // that beats disabled={pending}) can both read a DRAFT and both pass the
  // check above, but only one updateMany can match it. Whoever loses the
  // claim never sends.
  const claimed = await db.inquiry.updateMany({
    where: { id: inquiry.id, status: "DRAFT" },
    data: { status: "SENT", sentAt: new Date() },
  });
  if (claimed.count === 0) {
    return { error: "That inquiry has already been sent." };
  }

  try {
    await sendEmails([
      inquiryEmail({ to, subject, message: inquiry.message, hostEmail: user.email }),
    ]);
  } catch (error) {
    // Say which end failed, the way lib/email/failure.ts does elsewhere: a
    // host who cannot tell "your sender isn't verified" from "that address
    // bounced" will retry the wrong one forever.
    //
    // `cause` is a getter on EmailSendError (lib/email/failure.ts:26) that
    // classifies the status and body into "sender" | "recipient" | "unknown".
    // It is NOT called `failure` — that is the name of the returned type.
    const failure = error instanceof EmailSendError ? error.cause : "unknown";

    if (failure === "sender" || failure === "recipient") {
      // The provider explicitly rejected this one — nothing left the
      // building — so it is both safe and necessary to undo the claim and
      // let the host fix it and resend.
      await db.inquiry.updateMany({
        where: { id: inquiry.id, status: "SENT" },
        data: { status: "DRAFT", sentAt: previousSentAt },
      });
      return {
        error:
          failure === "recipient"
            ? "That address bounced. Check it and try again."
            : "The message couldn't be sent. Nothing was delivered.",
      };
    }

    // "unknown" is exactly the class where the provider may have already
    // accepted the message and the response was lost — a fetch timeout
    // throws a plain TypeError here, not an EmailSendError. Reverting to
    // DRAFT would invite a retry that mails the vendor twice, so the row
    // stays claimed as SENT and we say we're not sure, rather than claim
    // nothing went out. The status select already makes SENT→DRAFT a
    // one-click recovery if the host wants to retry anyway.
    return {
      error:
        "We couldn't confirm that went out. It's marked sent — set it back to Draft if you want to try again.",
    };
  }

  refresh();
  return undefined;
}
```

Extend the imports at the top of `lib/actions/inquiries.ts`:

```ts
import { composeInquiry, inquiryEmail, normalizeRecipient } from "@/lib/outreach";
import { isEmailConfigured, sendEmails } from "@/lib/email/send";
import { EmailSendError } from "@/lib/email/failure";
import { LIMITS, RateLimitError, assertRateLimit } from "@/lib/rate-limit";
```

(The `composeInquiry, normalizeRecipient` import was added in Task 1 — extend that line rather than adding a second one. The `assertRateLimit` import follows the same calling convention as `lib/actions/auth.ts` and `lib/actions/events.ts`: wrap the call in try/catch and turn a caught `RateLimitError` into `{ error: error.message }`.)

- [ ] **Step 6: Put the Send button in the panel**

In `components/inquiry-panel.tsx`, add a send form. It must be its **own** `<form>`, separate from the existing update form — nested forms are invalid HTML and the status select must not be submitted by a send.

This file already imports a named group from `@/lib/actions/inquiries` (`deleteInquiryAction, startInquiryAction, updateInquiryAction`) — add to that group rather than writing a second import statement:

```tsx
import {
  deleteInquiryAction,
  sendInquiryAction,
  startInquiryAction,
  updateInquiryAction,
} from "@/lib/actions/inquiries";
```

Then, beside the existing `mailto:` link, render:

```tsx
      {inquiry.status === "DRAFT" && inquiry.toEmail ? (
        <form action={sendAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <SendButton />
        </form>
      ) : null}
      {sendState?.error ? (
        <p className="text-[13px] text-danger">{sendState.error}</p>
      ) : null}
```

Wire the state with `useActionState`, matching how the existing update form in this file does it:

```tsx
  const [sendState, sendAction] = useActionState(sendInquiryAction, undefined);
```

And add the pending-aware button alongside the file's other small components:

```tsx
/** Disabled while pending: a second click would be a second email to a real
 *  business. */
function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-surface disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send it"}
    </button>
  );
}
```

`useActionState` (from `react`) and `useFormStatus` (from `react-dom`) are both already imported at the top of this file — lines 3 and 4 — so neither needs adding.

- [ ] **Step 7: Verify**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Check it by hand**

Run: `npm run dev`

You need a working transport. The cheapest is SMTP with a Gmail app password — set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` in `.env` per `.env.example`. If you use Resend instead, note that until you verify a domain it **only delivers to your own address**, so send the test inquiry to yourself.

Then: open an event, shortlist a listing, start an inquiry, put your own address in "Their email", press "Send it". Expect the mail to arrive, its Reply-To to be your account's address, the status to become `SENT`, and the button to disappear. Press browser-back and re-submit: expect "That inquiry has already been sent" rather than a second email.

Report what you observed. If you cannot configure a transport in this environment, say so plainly and mark this step unverified rather than claiming it passed.

- [ ] **Step 9: Commit**

```bash
git add lib/outreach.ts tests/unit/outreach.test.ts lib/actions/inquiries.ts components/inquiry-panel.tsx
git commit -m "$(cat <<'EOF'
Send the vendor inquiry from here, one click at a time

The draft existed; sending it meant copying it into your own mail client
and remembering to come back and set the status. Now the host presses send
on each message and Hosty delivers it, with Reply-To pointing at them so
the answer reaches a person rather than an inbox nothing reads.

Only a DRAFT can be sent, so a second click cannot mail a vendor twice.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

### Task 3: Say who has gone quiet

A host chasing eight vendors cannot hold in their head who they mailed nine days ago. This is pure arithmetic over rows Hosty already has.

**Files:**
- Create: `lib/chase.ts`
- Test: `tests/unit/chase.test.ts`
- Modify: `app/(app)/events/[id]/shortlist/page.tsx`

**Interfaces:**
- Consumes: `Inquiry` rows with `status: InquiryStatus`, `sentAt: Date | null`, `respondedAt: Date | null`; the page already loads them at `app/(app)/events/[id]/shortlist/page.tsx:41` via `db.inquiry.findMany({ where: { eventId: event.id } })`.
- Produces: `CHASE_AFTER_DAYS: number` and `goneQuiet<T extends ChaseableInquiry>(inquiries: T[], now: Date): T[]` exported from `lib/chase.ts`, where `ChaseableInquiry = { status: InquiryStatus; sentAt: Date | null; respondedAt: Date | null }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/chase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHASE_AFTER_DAYS, goneQuiet } from "@/lib/chase";
import type { InquiryStatus } from "@/generated/prisma/enums";

const NOW = new Date("2026-03-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function inquiry(over: {
  status: InquiryStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
}) {
  return { sentAt: null, respondedAt: null, ...over };
}

describe("which inquiries have gone quiet", () => {
  it("counts one sent longer ago than the threshold", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS + 1) })];

    expect(goneQuiet(rows, NOW)).toHaveLength(1);
  });

  // The threshold is the point at which chasing becomes reasonable, so it
  // counts — a vendor silent for exactly this long is the case this exists for.
  it("counts one sent exactly at the threshold", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS) })];

    expect(goneQuiet(rows, NOW)).toHaveLength(1);
  });

  it("leaves a recent one alone", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS - 1) })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  it("never chases someone who already answered", () => {
    const rows = [
      inquiry({ status: "REPLIED", sentAt: daysAgo(30), respondedAt: daysAgo(28) }),
      inquiry({ status: "QUOTED", sentAt: daysAgo(30) }),
      inquiry({ status: "BOOKED", sentAt: daysAgo(30) }),
      inquiry({ status: "DECLINED", sentAt: daysAgo(30) }),
    ];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  it("ignores a draft, however old — nothing was ever sent", () => {
    const rows = [inquiry({ status: "DRAFT", sentAt: null })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  // Defensive: SENT with no sentAt should not be treated as infinitely old.
  it("ignores a sent row with no timestamp rather than chasing it forever", () => {
    const rows = [inquiry({ status: "SENT", sentAt: null })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/chase.test.ts`
Expected: FAIL — cannot resolve `@/lib/chase`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/chase.ts`:

```ts
import type { InquiryStatus } from "@/generated/prisma/enums";

/**
 * Who has not come back to you.
 *
 * A host lining up a venue, caterers, AV and security is tracking six or eight
 * threads at once, and the one that quietly never answered is the one that
 * costs them the date. This is the arithmetic they would otherwise do from
 * memory.
 *
 * It only ever reports. Chasing is a message to a real business, and those go
 * out one at a time with the host's approval — see lib/actions/inquiries.ts.
 */

/** Long enough that a vendor has plausibly just been busy, short enough to
 *  still change your mind about them. */
export const CHASE_AFTER_DAYS = 5;

export type ChaseableInquiry = {
  status: InquiryStatus;
  sentAt: Date | null;
  respondedAt: Date | null;
};

/** Statuses that mean the vendor has answered, whatever the answer was. */
const ANSWERED: InquiryStatus[] = ["REPLIED", "QUOTED", "BOOKED", "DECLINED"];

export function goneQuiet<T extends ChaseableInquiry>(inquiries: T[], now: Date): T[] {
  const cutoff = now.getTime() - CHASE_AFTER_DAYS * 86_400_000;

  return inquiries.filter((inquiry) => {
    if (inquiry.status !== "SENT") return false;
    if (ANSWERED.includes(inquiry.status)) return false;
    if (inquiry.respondedAt) return false;
    // No timestamp means we cannot say how long it has been, and guessing
    // "forever" would nag about a row that may have been sent minutes ago.
    if (!inquiry.sentAt) return false;
    return inquiry.sentAt.getTime() <= cutoff;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/chase.test.ts`
Expected: PASS, all six cases.

- [ ] **Step 5: Surface it on the shortlist page**

In `app/(app)/events/[id]/shortlist/page.tsx`, add the import:

```ts
import { goneQuiet } from "@/lib/chase";
```

The page already loads `inquiries` (line 41). After that load, compute:

```ts
  const quiet = goneQuiet(inquiries, new Date());
```

Then render a single line above the listing grid — locate the grid by content, not line number:

```tsx
        {quiet.length > 0 ? (
          <p className="mb-4 text-[13px] text-ink-mute">
            {quiet.length === 1
              ? "1 inquiry has had no reply for a few days."
              : `${quiet.length} inquiries have had no reply for a few days.`}
          </p>
        ) : null}
```

Say nothing when the list is empty — the same rule the rest of this app follows (`components/night-advice.tsx:34` renders nothing on an ordinary night, because a panel that always appears gets ignored).

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/chase.ts tests/unit/chase.test.ts app/\(app\)/events/\[id\]/shortlist/page.tsx
git commit -m "$(cat <<'EOF'
Say which vendors never came back

Eight open threads is more than anyone tracks from memory, and the one
that quietly never answered is the one that costs you the date. Counting
only; the follow-up itself is still a message a host presses send on.

Claude-Session: https://claude.ai/code/session_01P6GKArbHhjwRTAVyhNrQqa
EOF
)"
```

---

## Final verification

- [ ] **Run the gate CI runs**

```bash
npm run lint
npm run typecheck
npm test
```

All three must pass. CI additionally runs `npx prisma migrate deploy` against a throwaway Postgres and then Playwright (`.github/workflows/ci.yml`). **This plan adds a migration**, so the CI migrate step is load-bearing here in a way it is not for most changes — if it fails, the hand-written SQL is wrong, not the tests.

```bash
npm run test:e2e
```

Task 2 changes `components/inquiry-panel.tsx`, which `tests/e2e/spine.spec.ts` reaches through the shortlist step. Run it before pushing.

- [ ] **Push and open the PR**

```bash
git push -u origin vendor-outreach-send
```

The PR description should state plainly that vendor replies are **not** threaded back into Hosty — they arrive in the host's own inbox via Reply-To, and `REPLIED`/`QUOTED`/`BOOKED` remain manual. That is the single most likely thing for a reader to assume was built.

## Self-review notes

**1. Spec coverage.** The problem statement names outreach to *speakers, security, venues and catering*. Venues and catering are `ListingCategory` values and are covered. **Speakers do not inherit the send loop.** `composeInquiry` writes questions for the `SPEAKER` collaborator kind, but a speaker is an `EventCollaborator` row rendered through `OutreachCard` (`components/outreach-card.tsx`), not an `Inquiry` row — `OutreachCard` has no send path, and nothing in this branch sends mail to them. `EventCollaborator` already carries `email`/`phone`/`website` columns, so speakers are, ironically, the rows with a recipient and no sender: the inverse of the gap catalog vendors had before this branch, and worth pointing at for the next slice. **Security is not covered** — `ListingCategory` has no `SECURITY` value and adding one was explicitly not the chosen slice. That is a real gap against the stated problem, recorded here rather than quietly dropped; it is roughly a one-day change (enum value, migration, label, icon, template weights) and wants its own plan.

The three product decisions are honoured: nothing in this plan is campus-shaped (decision 1); it is the outreach loop rather than categories or supply (decision 2); and every send is one host click on one message, with no batch path and no automatic chasing (decision 3).

**2. Placeholder scan.** No TBDs, no "add error handling" — the failure branch names its two cases and their copy. Every code step carries the literal text to write. The one generated artifact (the migration SQL) is generated by a named command, with the expected output shown and a check for what would make it wrong.

**3. Type consistency.** `normalizeRecipient(string | null | undefined): string | null` is used in Task 1's action and Task 2's action with those types. `inquiryEmail` returns `OutgoingEmail`, exactly what `sendEmails(emails: OutgoingEmail[])` consumes. `goneQuiet<T extends ChaseableInquiry>(inquiries: T[], now: Date): T[]` is generic so the page's full Prisma rows pass through without a cast, and `ChaseableInquiry`'s three fields all exist on `Inquiry`. `sendInquiryAction` matches `updateInquiryAction`'s `(_prev: InquiryFormState, formData: FormData)` shape, which is what `useActionState` requires.

**One redundancy, left deliberately:** `goneQuiet` checks `status !== "SENT"` and then checks the `ANSWERED` list, which cannot match after the first check. The second check is there so that adding a new terminal status later fails safe rather than silently starting to nag about it. A reviewer may flag it; this note is the answer.

## What this does not solve, and should not be mistaken for

The problem statement is about **capacity** — a small team cannot run a 300-person event. This plan removes the copy-paste and the remembering from vendor outreach. It does not:

- **Find vendors.** `Listing` is a thin catalog with no contact details. The host still sources the address. A real supply side is a marketplace business, not a feature.
- **Read replies.** No inbound email, so quotes are still typed in by hand.
- **Help with execution.** The run sheet — the thing a host holds during the event — is untouched by this plan.

Each is a larger piece of work than everything above, and each deserves its own spec before anyone writes code.
