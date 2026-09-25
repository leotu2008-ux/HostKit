# Waitlist Approval and an Honest Front Door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hosty's access story consistent. People join a waitlist, the administrator approves them from `/admin/waitlist`, approved people set a password and get the full host app, and nothing on the website promises "free to start" or anonymous drafts.

**Architecture:** A nullable `User.approvedAt` becomes the third way into the dashboard, beside Maya and the administrator, all in `hasDashboardAccess` (`lib/access.ts`). Approving a waitlist entry (`lib/waitlist-approval.ts`) creates or updates the User, stamps both rows, and emails a 7-day set-password link through the existing reset-token machinery in `lib/account.ts`. The front door changes are: `createBlankEventAction` refuses callers without access and sends them to `/signup`, and the landing page and top bar show "Join the waitlist" to anyone who can't create events.

**Tech Stack:** Next.js 16.3 App Router (read `node_modules/next/dist/docs/` before touching routing), Prisma 7 + Postgres (Neon), Vitest 4 (node environment, `vi.mock` for `@/lib/db`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-22-scope-lock-recurring-hosts.md`. This plan implements "In scope" items 1 and 2 and "Additions for access". Plan 2 (recurring-host features) implements item 3.

## Global Constraints

- The administrator is an address in `ADMIN_EMAILS` (`isAdmin` in `lib/access.ts`). Only `isAdmin(user)` may approve.
- Dashboard access = `isMayaChen(user) || isAdmin(user) || user.approvedAt != null`. No other path.
- Frozen areas (iOS, Clubs, Discover/campus, anonymous draft claiming) get no new UI or copy. The only allowed change there is the access check behind `createBlankEventAction`.
- The migration is additive only (new nullable columns, one unique index, one FK). Vercel preview builds run `prisma migrate deploy` against the production database.
- `"use server"` exports are public endpoints: every server action re-checks `isAdmin` or access itself.
- Never use browser `confirm()` dialogs. Actions that send email or delete use a two-step button.
- User-facing copy: plain, second person, no "free to start" and no "no account needed".
- Commit messages are plain imperative sentences (repo style, e.g. "Let the administrator remove any event from an admin page.").
- Ship through `git push no-mistakes <branch>`, never directly to `main`.

## Review Focus

1. **Someone approved who already has a User row** (they signed up in an older flow): approval must update that row, not crash on the unique email. Pinned by Task 2 "approves an existing user row instead of creating a duplicate".
2. **Approving the same entry twice** (double click, two tabs): the second call sends no second invite and changes nothing. Pinned by Task 2 "is a no-op for an entry that is already approved".
3. **An approved person whose invite link expired:** "Forgot password" must get them in, and opening that link must count as proving the inbox. Pinned by Task 2 "marks the address verified when a reset link is used".
4. **A signed-in user without access pressing "Create event"** (stale session): sent to `/signup` and no Event row created. Pinned by Task 4 "sends a caller without access to the waitlist and creates nothing".
5. **Mixed-case or padded emails**: the created User uses the normalized address already stored on the entry (`joinEmailList` lowercases and trims). Pinned by Task 2 "creates the user from the entry's stored, normalized email".

---

## File Structure

- `prisma/schema.prisma`: adds `User.approvedAt`, `EmailListEntry.approvedAt` and `EmailListEntry.userId` (+ relation).
- `prisma/migrations/20260923000000_waitlist_approval/migration.sql` (new): the additive SQL.
- `lib/access.ts`: `hasDashboardAccess` takes `approvedAt`.
- `lib/session.ts`, `lib/api/http.ts`: select `approvedAt` so access checks see it.
- `lib/account.ts`: new `INVITE_TTL_MS` and `sendApprovalInvite`. `resetPassword` also marks the email verified.
- `lib/waitlist-approval.ts` (new): `approveWaitlistEntry`, the only writer for approvals (deliberately not `"use server"`).
- `lib/actions/admin.ts`: new `approveWaitlistEntryAction`.
- `app/(app)/admin/waitlist/page.tsx` (new), `components/admin-approve-button.tsx` (new), `components/account-menu.tsx`: the admin UI.
- `lib/actions/events.ts`: `createBlankEventAction` requires access.
- `components/landing.tsx`, `app/page.tsx`, `components/app-frame.tsx`, `README.md`: honest calls to action.
- Tests: `tests/unit/access.test.ts`, `tests/unit/waitlist-approval.test.ts` (new), `tests/unit/reset-verifies.test.ts` (new), `tests/unit/admin.test.ts`, `tests/unit/create-event-access.test.ts` (new), `tests/unit/landing-motion.test.ts`.

---

### Task 1: Approval column and the access rule

**Files:**
- Modify: `prisma/schema.prisma` (models `User`, `EmailListEntry`)
- Create: `prisma/migrations/20260923000000_waitlist_approval/migration.sql`
- Modify: `lib/access.ts:22-24`
- Modify: `lib/session.ts:9-16` (`getCurrentUser`) and `currentProfile`'s `select` in the same file
- Modify: `lib/api/http.ts:34-37` (the bearer-token user `select`)
- Test: `tests/unit/access.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `hasDashboardAccess(user: { email: string; name: string; approvedAt: Date | null }): boolean`. `getCurrentUser()` now returns `{ id: string; email: string; name: string; approvedAt: Date | null } | null`. `currentProfile()` rows now include `approvedAt`. Prisma fields `User.approvedAt: DateTime?`, `EmailListEntry.approvedAt: DateTime?` and `EmailListEntry.userId: String? @unique` (relation `EmailListEntry.user` / `User.emailListEntry`).

- [ ] **Step 1: Write the failing test**

In `tests/unit/access.test.ts`, first add `approvedAt: null` as a third property to every existing `hasDashboardAccess({ … })` call (for example `hasDashboardAccess({ email: "admin@example.com", name: "Hosty", approvedAt: null })`), so the admin and Maya cases prove they don't need approval. Then append inside `describe("dashboard access", …)`:

```ts
  it("lets an approved waitlister in, and nobody who isn't", () => {
    expect(
      hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: new Date("2026-09-23") }),
    ).toBe(true);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null })).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/access.test.ts`
Expected: FAIL. The approved user is refused, because `approvedAt` is ignored.

- [ ] **Step 3: Implement the access rule**

In `lib/access.ts` replace `hasDashboardAccess` with:

```ts
/** Who gets past the closed-access gate: Maya, the administrator, and anyone
 *  the administrator approved off the waitlist (lib/waitlist-approval.ts). */
export function hasDashboardAccess(user: { email: string; name: string; approvedAt: Date | null }): boolean {
  return isMayaChen(user) || isAdmin(user) || user.approvedAt !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the columns**

In `prisma/schema.prisma`, add to `model User` next to `emailVerifiedAt`:

```prisma
  /// Set when the administrator approves this person off the waitlist.
  approvedAt       DateTime?
  emailListEntry   EmailListEntry?
```

Replace `model EmailListEntry` with:

```prisma
model EmailListEntry {
  id         String    @id @default(cuid())
  email      String    @unique
  name       String
  createdAt  DateTime  @default(now())
  /// Set when the administrator lets this person in.
  approvedAt DateTime?
  userId     String?   @unique
  user       User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

Create `prisma/migrations/20260923000000_waitlist_approval/migration.sql`:

```sql
-- Waitlist approval: additive only.
ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "EmailListEntry" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "EmailListEntry_userId_key" ON "EmailListEntry"("userId");

ALTER TABLE "EmailListEntry" ADD CONSTRAINT "EmailListEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 6: Carry approvedAt to every access check**

In `lib/session.ts` `getCurrentUser`, replace the lookup and return with:

```ts
  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { sessionVersion: true, approvedAt: true },
  });
  if (!row || row.sessionVersion !== (session.user.sessionVersion ?? 0)) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    approvedAt: row.approvedAt,
  };
```

In the same file, add `approvedAt: true` to the `select` of `currentProfile`'s `db.user.findUnique`.

In `lib/api/http.ts`, add `approvedAt: true` to the `select` of the bearer-token `db.user.findUnique` (the one that already selects `sessionVersion`).

`lib/auth.ts` and `app/api/v1/auth/token/route.ts` load the full User row with no `select`, so they already carry `approvedAt`. Leave them unchanged.

- [ ] **Step 7: Typecheck and full suite**

Run: `npx next typegen`, then `npm run typecheck`
Expected: exit 0. Any error at a `hasDashboardAccess(...)` call means that caller's object lacks `approvedAt`. Add `approvedAt: true` to that caller's `select`, as in `lib/api/http.ts`.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260923000000_waitlist_approval lib/access.ts lib/session.ts lib/api/http.ts tests/unit/access.test.ts
git commit -m "Let approved waitlisters into the dashboard."
```

---

### Task 2: Approving a waitlist entry

**Files:**
- Modify: `lib/account.ts` (add `INVITE_TTL_MS` and `sendApprovalInvite`; change `resetPassword`)
- Create: `lib/waitlist-approval.ts`
- Test: `tests/unit/waitlist-approval.test.ts` (new), `tests/unit/reset-verifies.test.ts` (new)

**Interfaces:**
- Consumes: from Task 1, `User.approvedAt`, `EmailListEntry.approvedAt` and `EmailListEntry.userId`.
- Produces: `approveWaitlistEntry(entryId: string, origin: string): Promise<{ email: string; alreadyApproved: boolean }>`, which throws `AccountError("That person is not on the waitlist.", 404)` for an unknown id. Also `sendApprovalInvite(user: { id: string; email: string; name: string }, origin: string): Promise<{ devLink?: string }>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/waitlist-approval.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entryFind: vi.fn(),
  entryUpdate: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  invite: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    emailListEntry: { findUnique: mocks.entryFind, update: mocks.entryUpdate },
    user: { findUnique: mocks.userFind, create: mocks.userCreate, update: mocks.userUpdate },
  },
}));
vi.mock("@/lib/account", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account")>("@/lib/account");
  return { ...actual, sendApprovalInvite: mocks.invite };
});

import { approveWaitlistEntry } from "@/lib/waitlist-approval";

const ENTRY = { id: "wl-1", email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null, userId: null };

describe("approveWaitlistEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invite.mockResolvedValue({});
    mocks.userCreate.mockImplementation(async ({ data }) => ({ id: "u-new", ...data }));
    mocks.userUpdate.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      email: ENTRY.email,
      name: ENTRY.name,
      ...data,
    }));
  });

  it("creates the user from the entry's stored, normalized email, approves both rows and sends one invite", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue(null);

    const result = await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    const created = mocks.userCreate.mock.calls[0][0].data;
    expect(created.email).toBe("sam@babson.edu");
    expect(created.name).toBe("Sam Okafor");
    expect(created.approvedAt).toBeInstanceOf(Date);
    expect(typeof created.passwordHash).toBe("string");
    expect(mocks.entryUpdate).toHaveBeenCalledWith({
      where: { id: "wl-1" },
      data: { approvedAt: expect.any(Date), userId: "u-new" },
    });
    expect(mocks.invite).toHaveBeenCalledTimes(1);
    expect(mocks.invite.mock.calls[0][1]).toBe("https://tryhosty.app");
    expect(result).toEqual({ email: "sam@babson.edu", alreadyApproved: false });
  });

  it("approves an existing user row instead of creating a duplicate", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue({ id: "u-old", email: ENTRY.email, name: ENTRY.name, approvedAt: null });

    await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "u-old" }, data: { approvedAt: expect.any(Date) } });
    expect(mocks.entryUpdate.mock.calls[0][0].data.userId).toBe("u-old");
    expect(mocks.invite).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an entry that is already approved", async () => {
    mocks.entryFind.mockResolvedValue({ ...ENTRY, approvedAt: new Date("2026-09-20"), userId: "u-old" });

    const result = await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    expect(result).toEqual({ email: "sam@babson.edu", alreadyApproved: true });
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("refuses an unknown entry", async () => {
    mocks.entryFind.mockResolvedValue(null);
    await expect(approveWaitlistEntry("nope", "https://tryhosty.app")).rejects.toThrow("not on the waitlist");
    expect(mocks.invite).not.toHaveBeenCalled();
  });
});
```

Create `tests/unit/reset-verifies.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenFind: vi.fn(),
  tokenUpdate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    accountToken: { findUnique: mocks.tokenFind, update: mocks.tokenUpdate },
    user: { update: mocks.userUpdate },
  },
}));

import { resetPassword } from "@/lib/account";

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenFind.mockResolvedValue({
      id: "t-1",
      userId: "u-1",
      kind: "reset",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.tokenUpdate.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({ email: "sam@babson.edu" });
  });

  it("marks the address verified when a reset link is used", async () => {
    await expect(resetPassword("raw-token", "a-long-password")).resolves.toBe("sam@babson.edu");
    const { where, data } = mocks.userUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: "u-1" });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(data.sessionVersion).toEqual({ increment: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/waitlist-approval.test.ts tests/unit/reset-verifies.test.ts`
Expected: FAIL. The approval file fails on the missing `@/lib/waitlist-approval` module, and the reset test fails because `emailVerifiedAt` is undefined.

- [ ] **Step 3: Implement the invite and the verified-on-reset rule**

In `lib/account.ts`, next to `RESET_TTL_MS`, add:

```ts
/** An approval invite is a set-password link; a week to act on it. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;
```

Add after `requestPasswordReset`:

```ts
/**
 * The administrator let this person in. Their account exists with an unusable
 * password; this link sets the real one. It rides the reset-token machinery,
 * so /reset-password handles it and an expired invite is fixed by "Forgot
 * password" like any other account.
 */
export async function sendApprovalInvite(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<{ devLink?: string }> {
  const token = await issue(user.id, "reset", INVITE_TTL_MS);
  const link = `${origin}/reset-password?token=${token}`;
  return deliver(
    user.email,
    "You're in — set your Hosty password",
    [
      `Hi ${user.name.split(" ")[0] || "there"},`,
      "",
      "You're off the Hosty waitlist. Set a password to start planning:",
      link,
      "",
      "The link works for a week. After that, use “Forgot password” on the sign-in page.",
    ].join("\n"),
    link,
    true,
  );
}
```

In `resetPassword`, change the `data` of the `db.user.update` to:

```ts
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      sessionVersion: { increment: 1 },
      // Opening a link sent to the inbox proves the inbox.
      emailVerifiedAt: new Date(),
    },
```

Create `lib/waitlist-approval.ts`:

```ts
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AccountError, sendApprovalInvite } from "@/lib/account";
import { db } from "@/lib/db";

/**
 * The administrator lets one waitlist entry in. Deliberately not "use server"
 * (a "use server" export is a public endpoint): lib/actions/admin.ts wraps it
 * behind the admin check.
 *
 * Idempotent: an entry that's already approved sends nothing and changes
 * nothing, so a double click can't mail two invites.
 */
export async function approveWaitlistEntry(
  entryId: string,
  origin: string,
): Promise<{ email: string; alreadyApproved: boolean }> {
  const entry = await db.emailListEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new AccountError("That person is not on the waitlist.", 404);
  if (entry.approvedAt) return { email: entry.email, alreadyApproved: true };

  const now = new Date();
  const existing = await db.user.findUnique({ where: { email: entry.email } });
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { approvedAt: now } })
    : await db.user.create({
        data: {
          email: entry.email,
          name: entry.name,
          // Unusable until the invite link sets a real one.
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
          approvedAt: now,
        },
      });

  await db.emailListEntry.update({ where: { id: entry.id }, data: { approvedAt: now, userId: user.id } });
  await sendApprovalInvite({ id: user.id, email: user.email, name: user.name }, origin);
  return { email: entry.email, alreadyApproved: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/waitlist-approval.test.ts tests/unit/reset-verifies.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite and typecheck**

Run: `npm test`, then `npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/account.ts lib/waitlist-approval.ts tests/unit/waitlist-approval.test.ts tests/unit/reset-verifies.test.ts
git commit -m "Approve a waitlist entry and email a set-password link."
```

---

### Task 3: The admin waitlist page

**Files:**
- Modify: `lib/actions/admin.ts` (add `approveWaitlistEntryAction`)
- Create: `components/admin-approve-button.tsx`
- Create: `app/(app)/admin/waitlist/page.tsx`
- Modify: `components/account-menu.tsx` (admin rows)
- Test: `tests/unit/admin.test.ts`

**Interfaces:**
- Consumes: from Task 2, `approveWaitlistEntry(entryId, origin)`. Also the existing `isAdmin` (`lib/access.ts`), `getCurrentUser` (`lib/session.ts`) and `originFromHeaders(headers: Headers): string` (`lib/mcp/config.ts`, which reads `x-forwarded-host` or `host`, plus `x-forwarded-proto`).
- Produces: `approveWaitlistEntryAction(formData: FormData): Promise<void>`, which reads the `entryId` field.

- [ ] **Step 1: Write the failing test**

In `tests/unit/admin.test.ts`, add `approve: vi.fn()` to the hoisted `mocks`. Add these mocks next to the existing ones:

```ts
vi.mock("@/lib/waitlist-approval", () => ({ approveWaitlistEntry: mocks.approve }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "tryhosty.app", "x-forwarded-proto": "https" }),
}));
```

Change the admin import to `import { approveWaitlistEntryAction, deleteEventAsAdminAction } from "@/lib/actions/admin";` and append:

```ts
describe("approveWaitlistEntryAction", () => {
  function entryForm(entryId: string) {
    const data = new FormData();
    data.set("entryId", entryId);
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approve.mockResolvedValue({ email: "sam@babson.edu", alreadyApproved: false });
  });

  it("approves the entry when the administrator asks, linking back to this site", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await approveWaitlistEntryAction(entryForm("wl-1"));
    expect(mocks.approve).toHaveBeenCalledWith("wl-1", "https://tryhosty.app");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses anyone who is not the administrator", async () => {
    mocks.currentUser.mockResolvedValue(MAYA);
    await expect(approveWaitlistEntryAction(entryForm("wl-1"))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("refuses a request with no entry id", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await expect(approveWaitlistEntryAction(entryForm(""))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/admin.test.ts`
Expected: FAIL. `approveWaitlistEntryAction` is not exported.

- [ ] **Step 3: Implement the action**

In `lib/actions/admin.ts` add these imports:

```ts
import { headers } from "next/headers";
import { originFromHeaders } from "@/lib/mcp/config";
import { approveWaitlistEntry } from "@/lib/waitlist-approval";
```

and append:

```ts
/**
 * The administrator lets one waitlister in: creates or approves their account
 * and emails a set-password link (lib/waitlist-approval.ts). Public endpoint,
 * so the admin check is here.
 */
export async function approveWaitlistEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error("Only the administrator can approve people.");
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) throw new Error("No one to approve.");
  await approveWaitlistEntry(entryId, originFromHeaders(await headers()));
  refresh();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/admin.test.ts`
Expected: PASS (all delete and approve cases).

- [ ] **Step 5: Build the page, the button, and the menu rows**

Create `components/admin-approve-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { approveWaitlistEntryAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Sending invite…" : "Confirm & email invite"}
    </Button>
  );
}

/** Two steps, no browser dialog: approving emails the person, so it's armed first. */
export function AdminApproveButton({ entryId, name }: { entryId: string; name: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setArmed(true)} aria-label={`Let ${name} in`}>
        Let in
      </Button>
    );
  }
  return (
    <form action={approveWaitlistEntryAction} className="flex items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
      <ConfirmButton />
    </form>
  );
}
```

Create `app/(app)/admin/waitlist/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AdminApproveButton } from "@/components/admin-approve-button";
import { Badge, Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Waitlist" };

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Everyone who asked to get in, newest first. Anyone but the administrator gets a 404. */
export default async function AdminWaitlistPage() {
  const user = await requireUser("/admin/waitlist");
  if (!isAdmin(user)) notFound();

  const entries = await db.emailListEntry.findMany({ orderBy: { createdAt: "desc" } });
  const waiting = entries.filter((e) => !e.approvedAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Waitlist</h1>
        <Link href="/admin/events" className="text-sm font-medium text-clay hover:underline">
          All events
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {waiting} waiting. Letting someone in emails them a link to set a password.
      </p>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nobody yet" body="Sign-ups from the homepage land here." />
        </div>
      ) : (
        <Card className="mt-6 divide-y divide-line overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{entry.name}</p>
                <p className="text-[13px] text-ink-mute">
                  {entry.email} · joined {WHEN.format(entry.createdAt)}
                </p>
              </div>
              {entry.approvedAt ? (
                <Badge tone="forest">Let in {WHEN.format(entry.approvedAt)}</Badge>
              ) : (
                <AdminApproveButton entryId={entry.id} name={entry.name} />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
```

In `components/account-menu.tsx`, replace the `ADMIN_ROW` constant with:

```ts
/** Shown to the administrator only; the pages themselves 404 for anyone else. */
const ADMIN_ROWS = [
  { href: "/admin/waitlist", label: "Waitlist", hint: "Let people in" },
  { href: "/admin/events", label: "All events", hint: "Every event, remove any of them" },
];
```

and change `(isAdmin(user) ? [...ROWS, ADMIN_ROW] : ROWS)` to `(isAdmin(user) ? [...ROWS, ...ADMIN_ROWS] : ROWS)`.

- [ ] **Step 6: Typecheck, lint, suite**

Run: `npm run typecheck`, then `npx eslint components/admin-approve-button.tsx "app/(app)/admin/waitlist/page.tsx" components/account-menu.tsx lib/actions/admin.ts`, then `npm test`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/admin.ts components/admin-approve-button.tsx "app/(app)/admin/waitlist/page.tsx" components/account-menu.tsx tests/unit/admin.test.ts
git commit -m "Give the administrator a waitlist page to let people in."
```

---

### Task 4: An honest front door

**Files:**
- Modify: `lib/actions/events.ts:20-32` (`createBlankEventAction`)
- Modify: `components/landing.tsx` (hero CTA ~lines 143-162, closing CTA ~lines 256-272)
- Modify: `app/page.tsx`
- Modify: `components/app-frame.tsx:71` (top-bar button)
- Modify: `README.md` (getting-started access line)
- Test: `tests/unit/create-event-access.test.ts` (new), `tests/unit/landing-motion.test.ts`

**Interfaces:**
- Consumes: from Task 1, `hasDashboardAccess(user)` with `approvedAt`, and `currentProfile()`, which now selects `approvedAt`.
- Produces: `Landing({ canCreate }: { canCreate: boolean })`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/create-event-access.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  eventCreate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/session", () => ({ currentProfile: mocks.profile }));
vi.mock("@/lib/db", () => ({ db: { event: { create: mocks.eventCreate } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createBlankEventAction } from "@/lib/actions/events";

describe("createBlankEventAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a signed-out visitor to the waitlist and creates nothing", async () => {
    mocks.profile.mockResolvedValue(null);
    await expect(createBlankEventAction()).rejects.toThrow("REDIRECT /signup");
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("sends a caller without access to the waitlist and creates nothing", async () => {
    mocks.profile.mockResolvedValue({
      id: "u-1",
      email: "sam@babson.edu",
      name: "Sam Okafor",
      approvedAt: null,
      schoolDomain: null,
    });
    await expect(createBlankEventAction()).rejects.toThrow("REDIRECT /signup");
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
```

If importing `@/lib/actions/events` fails because another of its imports touches the network or `next/headers` at import time, add a `vi.mock` stub for that module in this test file. Don't change `events.ts` just to make it importable.

In `tests/unit/landing-motion.test.ts`, change `createElement(Landing)` to `createElement(Landing, { canCreate: false })`. Replace the line `expect(lines[3]).toContain("Plan an event");` with:

```ts
    expect(lines[3]).toContain("Join the waitlist");
    expect(lines[3]).toContain('href="/signup"');
```

Replace the line `expect(lines[4]).toContain("Free to start.");` with:

```ts
    expect(lines[4]).toContain("Invite-only while we’re small.");
    expect(html).not.toContain("Free to start");
    expect(html).not.toContain("No account needed");
```

and add a new test at the end of `describe("landing page", …)`:

```ts
  it("offers a signed-in host with access the Plan an event button instead", () => {
    const hostHtml = renderToStaticMarkup(createElement(Landing, { canCreate: true }));
    expect(hostHtml).toContain("Plan an event");
    expect(hostHtml).not.toContain("Invite-only");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/create-event-access.test.ts tests/unit/landing-motion.test.ts`
Expected: FAIL. The action creates an event instead of redirecting, and the landing page still shows "Plan an event" and "Free to start."

- [ ] **Step 3: Gate event creation**

In `lib/actions/events.ts`, replace the start of `createBlankEventAction`, from `const user = await currentProfile();` down to the closing `}` of the `if (!user) { … }` rate-limit block, with:

```ts
export async function createBlankEventAction(): Promise<void> {
  const user = await currentProfile();
  // Hosty is invite-only: no anonymous drafts from the website, and no event
  // for anyone the administrator hasn't let in. They go to the waitlist.
  if (!user || !hasDashboardAccess(user)) redirect("/signup");
  const claimToken = null;
```

Add `import { hasDashboardAccess } from "@/lib/access";`. Grep the file for `newClaimToken`, `assertRateLimit`, `RateLimitError`, `clientIp` and `LIMITS`, and delete an import only if nothing else in the file still uses it. Leave `ownerId: user?.id ?? null` and the `if (claimToken)` line as they are: the claim code is frozen, and those lines are now simply the signed-in branch.

- [ ] **Step 4: Make the landing honest**

In `components/landing.tsx`, change the signature to `export function Landing({ canCreate }: { canCreate: boolean })` and add this helper above it:

```tsx
/** Invite-only: strangers join the waitlist; a host with access plans an event. */
function PrimaryCta({ canCreate }: { canCreate: boolean }) {
  if (canCreate) {
    return (
      <CreateEventButton
        label={
          <>
            Plan an event <span aria-hidden>→</span>
          </>
        }
        variant="brand"
        size="lg"
      />
    );
  }
  return (
    <ButtonLink href="/signup" variant="brand" size="lg">
      Join the waitlist <span aria-hidden>→</span>
    </ButtonLink>
  );
}
```

In the hero, replace the `<CreateEventButton … />` element labelled "Plan an event" with `<PrimaryCta canCreate={canCreate} />`, and replace the text `Free to start. No account needed until you publish.` with:

```tsx
            {canCreate
              ? "Brief it once. The agent takes it from there."
              : "Invite-only while we’re small. Join the waitlist and we’ll email you when you’re in."}
```

In the closing "Give it a date and a headcount" section, replace its `<CreateEventButton … />` with `<PrimaryCta canCreate={canCreate} />`, and replace its `<ButtonLink href="/signup" variant="secondary" size="lg">Join the waitlist</ButtonLink>` with:

```tsx
            {canCreate ? null : (
              <ButtonLink href="/signin" variant="secondary" size="lg">
                Sign in
              </ButtonLink>
            )}
```

Replace the body of `app/page.tsx`, keeping its existing doc comment above `HomePage`:

```tsx
import { Landing } from "@/components/landing";
import { hasDashboardAccess } from "@/lib/access";
import { currentProfile } from "@/lib/session";

export const metadata = { title: "Hosty — an agent that plans your event" };

export default async function HomePage() {
  const user = await currentProfile();
  return <Landing canCreate={Boolean(user && hasDashboardAccess(user))} />;
}
```

In `components/app-frame.tsx`, replace the top-bar `<CreateEventButton className="hidden h-9 items-center rounded-full px-4 text-sm font-medium md:inline-flex" />` with:

```tsx
              {user ? (
                <CreateEventButton className="hidden h-9 items-center rounded-full px-4 text-sm font-medium md:inline-flex" />
              ) : (
                <ButtonLink href="/signup" variant="brand" size="sm" className="hidden h-9 px-4 md:inline-flex">
                  Join the waitlist
                </ButtonLink>
              )}
```

Import `ButtonLink` from `@/components/ui` if the file doesn't already. A signed-in `user` here always has access, because sign-in refuses everyone else (`lib/auth.ts`).

In `README.md`, find the getting-started sentence saying access is closed and new sign-ups join the waitlist, and append: " The administrator lets people in from `/admin/waitlist`, and they get an email to set a password."

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/create-event-access.test.ts tests/unit/landing-motion.test.ts`
Expected: PASS.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck`, `npm run lint` and `npm test`
Expected: exit 0, no new lint errors, all suites pass. The e2e spine (`tests/e2e/spine.spec.ts`) signs in as Maya before pressing "Create event", so CI's end-to-end run still works.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/events.ts components/landing.tsx app/page.tsx components/app-frame.tsx README.md tests/unit/create-event-access.test.ts tests/unit/landing-motion.test.ts
git commit -m "Stop promising free-to-start: strangers join the waitlist, hosts with access plan events."
```

---

### Task 5: Ship and check

**Files:** none unless the check finds a defect.

- [ ] **Step 1:** Run `git push no-mistakes <branch>` and drive the run to `checks-passed`. Take any `ask-user` finding to the user word for word.
- [ ] **Step 2:** On the Vercel preview, signed out, check each of these:
  - The homepage shows "Join the waitlist" and "Invite-only while we're small".
  - Neither "Free to start" nor "No account needed" appears.
  - The top bar shows "Join the waitlist".
  - The "Create an event" button on `/discover` lands on `/signup`.
- [ ] **Step 3:** Merge only on the user's go-ahead. After the production deploy, the administrator opens `/admin/waitlist`, clicks "Let in" then "Confirm & email invite" on a test entry, and confirms the email arrives and its link sets a password.
