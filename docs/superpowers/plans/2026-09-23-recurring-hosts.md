# Recurring Hosts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a host's second, fifth and twentieth event faster than the first. There are four parts: a guest book (invite people who came before), a vendor book (reuse vendors you've worked with), "Run it again" (copy an event into a new dated draft), and series (repeat events linked under one name).

**Architecture:** Four new host-owned tables: `Series`, `Contact` and `VendorContact`, plus link columns on `Event`, `Guest` and `EventCollaborator`. They're filled automatically at a few choke points:
- a guest being added or registering
- a venue, speaker or cohost being confirmed
- a catalog inquiry being booked

Each feature is a plain library module (`lib/guest-book.ts`, `lib/vendor-book.ts`, `lib/run-again.ts`) wrapped by `requireEvent`-checked server actions, with a small UI on the existing workspace pages.

**Tech Stack:** Next.js 16.3 App Router (read `node_modules/next/dist/docs/` before touching routing), Prisma 7 + Postgres (Neon), Vitest 4 (node environment, `vi.mock("@/lib/db")`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-22-scope-lock-recurring-hosts.md`. This plan covers "In scope" item 3 and "Additions for recurring hosts", as amended 2026-09-23.

## Global Constraints

- The four features are Series, Run it again, Host guest book and Host vendor book. Nothing else ships in this plan.
- Guests and collaborators stay per-event. Book entries are the host-level identity they link to.
- Run it again copies the brief, budget split, vendors (collaborators) and run sheet into a new draft with a new date. **Guests are not copied.** Inquiries, budget items, blasts, activity and outcome are not copied either.
- Guest-book emails are stored lowercased and trimmed. One `Contact` per host and email address (`@@unique([ownerId, email])`). Guests without an email get no Contact.
- A guest counts as having "come" when `rsvpStatus = ATTENDING` or `checkedInAt` is set.
- The vendor book is filled only when a venue, speaker or cohost becomes `CONFIRMED`, or when a catalog inquiry becomes `BOOKED`. Nothing is backfilled for vendors.
- Book entries belong to the event's `ownerId`. An event with no owner neither reads nor writes books.
- Frozen areas (iOS, Clubs, Discover/campus, anonymous claiming) get no new UI or copy. `EventCard` is shared with Discover, so it isn't changed.
- The migration adds tables, nullable columns and indexes. Its only data change is the guest-book backfill (INSERT … ON CONFLICT DO NOTHING, plus an UPDATE of `Guest.contactId` where it's null). Vercel preview builds run `prisma migrate deploy` against the production database.
- `"use server"` exports are public endpoints: every new action calls `requireEvent(eventId)` (or checks ownership) itself. Write logic lives in plain `lib/*.ts` modules, never in `"use server"` files.
- No browser `confirm()` dialogs.
- Commit messages are plain imperative sentences.
- Ship through `git push no-mistakes <branch>`.

## Review Focus

1. **Running it again from an event with no date:** there's nothing to shift from. Tasks get their due date from the new date and offset, and run-sheet items keep their original clock time on the new day. Pinned by Task 4 "keeps run-sheet times of day when the source had no date".
2. **Running it again twice from the same event:** both copies land in the same series, and no second series is created. Pinned by Task 4 "reuses the source's series instead of creating another".
3. **The same person added with different email casing** (`Sam@X.com` then `sam@x.com`): one Contact, both guests linked to it. Pinned by Task 2 "links differently-cased emails to one contact".
4. **Inviting from the guest book someone already on the list** (by contact or by email): skipped, not duplicated. Pinned by Task 2 "skips people already on the list".
5. **A host inviting another host's contacts by posting foreign contact ids:** ignored. Only the event owner's contacts are used. Pinned by Task 2 "ignores contacts that belong to another host".

---

## File Structure

- `prisma/schema.prisma`: `Series`, `Contact`, `VendorContact`, plus link fields on `User`, `Event`, `Guest`, `EventCollaborator` and `Listing`.
- `prisma/migrations/20260923120000_recurring_hosts/migration.sql` (new): generated DDL plus the guest-book backfill.
- `lib/guest-book.ts` (new): `contactEmail`, `linkGuestsToContacts`, `guestBookFor`, `inviteFromGuestBook`.
- `lib/actions/guests.ts`: links contacts after adding guests. New `inviteFromGuestBookAction`.
- `lib/registration.ts`: links contacts after a registration changes the list.
- `components/guest-book-picker.tsx` (new), `app/(workspace)/events/[id]/(guests)/guests/page.tsx`: the picker.
- `lib/vendor-book.ts` (new): `rememberCollaborator`, `rememberBookedListing`, `vendorBookFor`, `addVendorToEvent`.
- `lib/actions/collaborators.ts`, `lib/actions/inquiries.ts`: remember on CONFIRMED and on BOOKED. New `addVendorFromBookAction`.
- `components/vendor-book-card.tsx` (new), `app/(workspace)/events/[id]/(outreach)/outreach/page.tsx`: the book.
- `lib/run-again.ts` (new): pure `planRerun` and DB `runEventAgain`.
- `lib/actions/run-again.ts` (new): `runAgainAction`.
- `app/(workspace)/events/[id]/run-again/page.tsx` (new), `components/workspace-bar.tsx`: the entry point.
- `app/(app)/series/[id]/page.tsx` (new), `app/(workspace)/events/[id]/page.tsx`: the series view and link.
- Tests: `tests/unit/guest-book.test.ts`, `tests/unit/vendor-book.test.ts`, `tests/unit/run-again.test.ts`, `tests/unit/run-again-action.test.ts` (all new).

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260923120000_recurring_hosts/migration.sql`

**Interfaces:**
- Produces these Prisma models:
  - `Series { id, ownerId, name, createdAt, owner, events }`
  - `Contact { id, ownerId, name, email: String?, phone: String?, createdAt, owner, guests }`, with compound unique `ownerId_email`
  - `VendorContact { id, ownerId, kind: CollaboratorKind?, category: ListingCategory?, name, email?, phone?, website?, listingId?, createdAt, owner, listing, collaborators }`, with compound unique `ownerId_listingId`
- Produces these new fields:
  - `Event.seriesId: String?`, `Event.series`, `Event.copiedFromId: String?`, `Event.copiedFrom`, `Event.copies`
  - `Guest.contactId: String?`, `Guest.contact`
  - `EventCollaborator.vendorContactId: String?`, `EventCollaborator.vendorContact`
  - `User.series`, `User.contacts`, `User.vendorContacts`, `Listing.vendorContacts`

- [ ] **Step 1: Save the base schema for diffing**

Run: `git show HEAD:prisma/schema.prisma > /tmp/recurring-base.prisma`

- [ ] **Step 2: Add the models**

Append to `prisma/schema.prisma`:

```prisma
/// A named run of repeat events owned by one host ("Thursday Pitch Night").
model Series {
  id        String   @id @default(cuid())
  ownerId   String
  name      String
  createdAt DateTime @default(now())

  owner  User    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  events Event[]

  @@index([ownerId])
}

/// A person in one host's guest book. Email is stored lowercased and trimmed.
model Contact {
  id        String   @id @default(cuid())
  ownerId   String
  name      String
  email     String?
  phone     String?
  createdAt DateTime @default(now())

  owner  User    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  guests Guest[]

  @@unique([ownerId, email])
  @@index([ownerId])
}

/// A vendor or venue in one host's vendor book: either a hand-entered
/// venue/speaker/cohost (kind set) or a catalog business (listingId + category set).
model VendorContact {
  id        String            @id @default(cuid())
  ownerId   String
  kind      CollaboratorKind?
  category  ListingCategory?
  name      String
  email     String?
  phone     String?
  website   String?
  listingId String?
  createdAt DateTime          @default(now())

  owner         User                @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  listing       Listing?            @relation(fields: [listingId], references: [id], onDelete: SetNull)
  collaborators EventCollaborator[]

  @@unique([ownerId, listingId])
  @@index([ownerId])
}
```

Add these relation fields:
- `model User`: `series Series[]`, `contacts Contact[]`, `vendorContacts VendorContact[]`.
- `model Listing`: `vendorContacts VendorContact[]`.
- `model Event` (fields next to `clubId`, relations next to `club`, index at the bottom):

```prisma
  seriesId         String?
  copiedFromId     String?
```
```prisma
  series           Series?             @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  copiedFrom       Event?              @relation("EventCopies", fields: [copiedFromId], references: [id], onDelete: SetNull)
  copies           Event[]             @relation("EventCopies")
```
```prisma
  @@index([seriesId])
```
- `model Guest`: `contactId String?`, `contact Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)`, `@@index([contactId])`.
- `model EventCollaborator`: `vendorContactId String?`, `vendorContact VendorContact? @relation(fields: [vendorContactId], references: [id], onDelete: SetNull)`.

Run: `npx prisma format`, then `npx prisma generate`
Expected: both succeed with no validation errors.

- [ ] **Step 3: Generate the DDL exactly**

Run: `mkdir -p prisma/migrations/20260923120000_recurring_hosts`
Run: `npx prisma migrate diff --from-schema /tmp/recurring-base.prisma --to-schema prisma/schema.prisma --script --output prisma/migrations/20260923120000_recurring_hosts/migration.sql`
Expected: the file contains only `CREATE TABLE`, `ALTER TABLE … ADD COLUMN`, `CREATE INDEX` / `CREATE UNIQUE INDEX` and `ADD CONSTRAINT … FOREIGN KEY` statements. It must contain no `DROP` and no `ALTER COLUMN`. If it does, the schema edit touched something it shouldn't have. Fix `schema.prisma` and regenerate.

If this Prisma version rejects `--output`, run the same command without it and redirect stdout to the file.

- [ ] **Step 4: Append the guest-book backfill**

Append to the end of `migration.sql`:

```sql

-- Backfill the guest book: one Contact per host and lowercased email, from existing guests.
INSERT INTO "Contact" ("id", "ownerId", "name", "email", "createdAt")
SELECT gen_random_uuid()::text, e."ownerId", MAX(g."name"), lower(trim(g."email")), MIN(g."createdAt")
FROM "Guest" g
JOIN "Event" e ON e."id" = g."eventId"
WHERE g."email" IS NOT NULL AND trim(g."email") <> '' AND e."ownerId" IS NOT NULL
GROUP BY e."ownerId", lower(trim(g."email"))
ON CONFLICT ("ownerId", "email") DO NOTHING;

UPDATE "Guest" g
SET "contactId" = c."id"
FROM "Event" e, "Contact" c
WHERE e."id" = g."eventId"
  AND c."ownerId" = e."ownerId"
  AND c."email" = lower(trim(g."email"))
  AND g."contactId" IS NULL;
```

- [ ] **Step 5: Typecheck and suite**

Run: `npx next typegen`, then `npm run typecheck`, then `npm test`
Expected: exit 0 and all suites pass. No code uses the new fields yet.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260923120000_recurring_hosts
git commit -m "Add series, a guest book and a vendor book to the data model."
```

---

### Task 2: Guest book

**Files:**
- Create: `lib/guest-book.ts`
- Modify: `lib/actions/guests.ts` (`addGuestsAction` and a new action)
- Modify: `lib/registration.ts` (after the `const result = await db.$transaction(...)` at ~line 112)
- Create: `components/guest-book-picker.tsx`
- Modify: `app/(workspace)/events/[id]/(guests)/guests/page.tsx`
- Test: `tests/unit/guest-book.test.ts`

**Interfaces:**
- Consumes: from Task 1, `Contact` and `Guest.contactId`.
- Produces:
  - `contactEmail(raw: string | null | undefined): string | null`
  - `linkGuestsToContacts(eventId: string): Promise<number>`
  - `guestBookFor(ownerId: string, eventId: string): Promise<GuestBookEntry[]>`, where `GuestBookEntry = { id: string; name: string; email: string | null; came: number }`
  - `inviteFromGuestBook(eventId: string, ownerId: string, contactIds: string[]): Promise<number>`
  - `inviteFromGuestBookAction(prev: GuestFormState, formData: FormData): Promise<GuestFormState>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/guest-book.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  guestFindMany: vi.fn(),
  guestUpdate: vi.fn(),
  guestCreateMany: vi.fn(),
  contactUpsert: vi.fn(),
  contactFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mocks.eventFind },
    guest: { findMany: mocks.guestFindMany, update: mocks.guestUpdate, createMany: mocks.guestCreateMany },
    contact: { upsert: mocks.contactUpsert, findMany: mocks.contactFindMany },
  },
}));

import { contactEmail, guestBookFor, inviteFromGuestBook, linkGuestsToContacts } from "@/lib/guest-book";

beforeEach(() => vi.clearAllMocks());

describe("contactEmail", () => {
  it("lowercases and trims, and treats blank as none", () => {
    expect(contactEmail("  Sam@X.com ")).toBe("sam@x.com");
    expect(contactEmail("   ")).toBeNull();
    expect(contactEmail(null)).toBeNull();
  });
});

describe("linkGuestsToContacts", () => {
  it("links differently-cased emails to one contact", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: "host-1" });
    mocks.guestFindMany.mockResolvedValue([
      { id: "g1", name: "Sam", email: "Sam@X.com" },
      { id: "g2", name: "Sam O", email: "sam@x.com" },
    ]);
    mocks.contactUpsert.mockResolvedValue({ id: "c1" });

    const linked = await linkGuestsToContacts("evt-1");

    expect(linked).toBe(2);
    for (const call of mocks.contactUpsert.mock.calls) {
      expect(call[0].where).toEqual({ ownerId_email: { ownerId: "host-1", email: "sam@x.com" } });
    }
    expect(mocks.guestUpdate).toHaveBeenCalledWith({ where: { id: "g1" }, data: { contactId: "c1" } });
    expect(mocks.guestUpdate).toHaveBeenCalledWith({ where: { id: "g2" }, data: { contactId: "c1" } });
  });

  it("does nothing for an event with no owner", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: null });
    expect(await linkGuestsToContacts("evt-1")).toBe(0);
    expect(mocks.contactUpsert).not.toHaveBeenCalled();
  });
});

describe("guestBookFor", () => {
  it("lists people who came before, most-attended first, excluding this event's guests", async () => {
    mocks.guestFindMany.mockResolvedValue([{ contactId: "c-already" }]);
    mocks.contactFindMany.mockResolvedValue([
      { id: "c1", name: "Ana", email: "ana@x.com", _count: { guests: 1 } },
      { id: "c2", name: "Bo", email: "bo@x.com", _count: { guests: 3 } },
    ]);

    const book = await guestBookFor("host-1", "evt-1");

    expect(book.map((e) => e.id)).toEqual(["c2", "c1"]);
    expect(book[0]).toEqual({ id: "c2", name: "Bo", email: "bo@x.com", came: 3 });
    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.ownerId).toBe("host-1");
    expect(where.id).toEqual({ notIn: ["c-already"] });
  });
});

describe("inviteFromGuestBook", () => {
  it("skips people already on the list", async () => {
    mocks.contactFindMany.mockResolvedValue([
      { id: "c1", name: "Ana", email: "ana@x.com" },
      { id: "c2", name: "Bo", email: "bo@x.com" },
      { id: "c3", name: "Cy", email: "cy@x.com" },
    ]);
    mocks.guestFindMany.mockResolvedValue([
      { contactId: "c1", email: "ana@x.com" },
      { contactId: null, email: "BO@x.com" },
    ]);

    const added = await inviteFromGuestBook("evt-1", "host-1", ["c1", "c2", "c3"]);

    expect(added).toBe(1);
    const data = mocks.guestCreateMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ eventId: "evt-1", contactId: "c3", name: "Cy", email: "cy@x.com" });
    expect(typeof data[0].rsvpToken).toBe("string");
  });

  it("ignores contacts that belong to another host", async () => {
    mocks.contactFindMany.mockResolvedValue([]);
    mocks.guestFindMany.mockResolvedValue([]);

    expect(await inviteFromGuestBook("evt-1", "host-1", ["someone-elses"])).toBe(0);
    expect(mocks.contactFindMany.mock.calls[0][0].where).toEqual({ id: { in: ["someone-elses"] }, ownerId: "host-1" });
    expect(mocks.guestCreateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/guest-book.test.ts`
Expected: FAIL with `Cannot find module '@/lib/guest-book'`.

- [ ] **Step 3: Implement `lib/guest-book.ts`**

```ts
import { db } from "@/lib/db";
import { newRsvpToken } from "@/lib/tokens";

/** Came = said yes, or was checked in at the door. */
const CAME = { OR: [{ rsvpStatus: "ATTENDING" as const }, { checkedInAt: { not: null } }] };

export type GuestBookEntry = { id: string; name: string; email: string | null; came: number };

/** Guest-book emails are stored lowercased and trimmed; blank means none. */
export function contactEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * Links every guest of this event who has an email to the host's Contact for
 * that address, creating the Contact the first time. Idempotent: only guests
 * without a contact are touched. Events with no owner have no guest book.
 */
export async function linkGuestsToContacts(eventId: string): Promise<number> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event?.ownerId) return 0;
  const ownerId = event.ownerId;

  const guests = await db.guest.findMany({
    where: { eventId, contactId: null, email: { not: null } },
    select: { id: true, name: true, email: true },
  });

  let linked = 0;
  for (const guest of guests) {
    const email = contactEmail(guest.email);
    if (!email) continue;
    const contact = await db.contact.upsert({
      where: { ownerId_email: { ownerId, email } },
      create: { ownerId, name: guest.name, email },
      update: {},
    });
    await db.guest.update({ where: { id: guest.id }, data: { contactId: contact.id } });
    linked += 1;
  }
  return linked;
}

/** People who came to one of this host's other events and aren't on this one. Most-attended first. */
export async function guestBookFor(ownerId: string, eventId: string): Promise<GuestBookEntry[]> {
  const onThisEvent = await db.guest.findMany({
    where: { eventId, contactId: { not: null } },
    select: { contactId: true },
  });
  const exclude = onThisEvent.map((g) => g.contactId as string);

  const contacts = await db.contact.findMany({
    where: { ownerId, id: { notIn: exclude }, guests: { some: { eventId: { not: eventId }, ...CAME } } },
    select: { id: true, name: true, email: true, _count: { select: { guests: { where: CAME } } } },
  });

  return contacts
    .map((c) => ({ id: c.id, name: c.name, email: c.email, came: c._count.guests }))
    .sort((a, b) => b.came - a.came || a.name.localeCompare(b.name));
}

/**
 * Invites the chosen contacts to this event as INVITED guests. Only the
 * owner's own contacts are used, and anyone already on the list (by contact or
 * by email) is skipped. Returns how many were added.
 */
export async function inviteFromGuestBook(eventId: string, ownerId: string, contactIds: string[]): Promise<number> {
  if (contactIds.length === 0) return 0;
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds }, ownerId },
    select: { id: true, name: true, email: true },
  });
  const existing = await db.guest.findMany({ where: { eventId }, select: { contactId: true, email: true } });
  const onList = new Set(existing.map((g) => g.contactId).filter(Boolean));
  const emails = new Set(existing.map((g) => contactEmail(g.email)).filter(Boolean));

  const fresh = contacts.filter((c) => !onList.has(c.id) && !(c.email && emails.has(c.email)));
  if (fresh.length === 0) return 0;

  await db.guest.createMany({
    data: fresh.map((c) => ({ eventId, contactId: c.id, name: c.name, email: c.email, rsvpToken: newRsvpToken() })),
  });
  return fresh.length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/guest-book.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Hook the two guest-creation paths and add the action**

In `lib/actions/guests.ts`:
- Import `import { inviteFromGuestBook, linkGuestsToContacts } from "@/lib/guest-book";`.
- In `addGuestsAction`, directly after the `await db.guest.createMany({ … });` call, add `await linkGuestsToContacts(eventId);`.
- Append:

```ts
/** Invites people from the host's guest book. The owner's contacts only. */
export async function inviteFromGuestBookAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.ownerId) return { error: "This event has no host yet." };
  const contactIds = formData.getAll("contactId").map(String).filter(Boolean);
  if (contactIds.length === 0) return { error: "Pick at least one person." };
  const added = await inviteFromGuestBook(event.id, event.ownerId, contactIds);
  if (added === 0) return { error: "Everyone you picked is already on the list." };
  refresh();
  return { added };
}
```

In `lib/registration.ts`, import `linkGuestsToContacts` from `@/lib/guest-book`. Directly after the statement `const result = await db.$transaction(async (tx) => { … });` closes, add:

```ts
  if (result.ok && result.changed) await linkGuestsToContacts(event.id);
```

- [ ] **Step 6: The picker UI**

Create `components/guest-book-picker.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { inviteFromGuestBookAction, type GuestFormState } from "@/lib/actions/guests";
import { Button } from "@/components/ui";
import type { GuestBookEntry } from "@/lib/guest-book";

/** Pick people who came to your earlier events and invite them in one go. */
export function GuestBookPicker({ eventId, entries }: { eventId: string; entries: GuestBookEntry[] }) {
  const [state, action, pending] = useActionState<GuestFormState, FormData>(inviteFromGuestBookAction, undefined);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const allPicked = picked.size === entries.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">From your guest book</h2>
          <p className="text-[13px] text-ink-mute">People who came to your other events.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPicked(allPicked ? new Set() : new Set(entries.map((e) => e.id)))}
        >
          {allPicked ? "Clear" : "Select everyone"}
        </Button>
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {entries.map((entry) => (
          <li key={entry.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                name="contactId"
                value={entry.id}
                checked={picked.has(entry.id)}
                onChange={() => toggle(entry.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{entry.name}</span>
                <span className="block truncate text-[12px] text-ink-mute">{entry.email}</span>
              </span>
              <span className="text-[12px] text-ink-mute">
                came {entry.came} {entry.came === 1 ? "time" : "times"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.added ? <p className="text-sm text-forest">Invited {state.added}.</p> : null}
      <Button type="submit" size="sm" disabled={pending || picked.size === 0}>
        {pending ? "Inviting…" : `Invite ${picked.size || ""}`.trim()}
      </Button>
    </form>
  );
}
```

In `app/(workspace)/events/[id]/(guests)/guests/page.tsx`, import `guestBookFor` from `@/lib/guest-book` and `GuestBookPicker` from `@/components/guest-book-picker`. After `const { event } = await requireEvent(id);`, add:

```ts
  const guestBook = event.ownerId ? await guestBookFor(event.ownerId, event.id) : [];
```

Directly after the `<Card className="p-5"><AddGuestsForm eventId={event.id} /></Card>` block, add:

```tsx
      {guestBook.length > 0 ? (
        <Card className="p-5">
          <GuestBookPicker eventId={event.id} entries={guestBook} />
        </Card>
      ) : null}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck`, then `npx eslint lib/guest-book.ts lib/actions/guests.ts lib/registration.ts components/guest-book-picker.tsx "app/(workspace)/events/[id]/(guests)/guests/page.tsx"`, then `npm test`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add lib/guest-book.ts lib/actions/guests.ts lib/registration.ts components/guest-book-picker.tsx "app/(workspace)/events/[id]/(guests)/guests/page.tsx" tests/unit/guest-book.test.ts
git commit -m "Keep a guest book and invite past guests from it."
```

---

### Task 3: Vendor book

**Files:**
- Create: `lib/vendor-book.ts`
- Modify: `lib/actions/collaborators.ts` (`setCollaboratorStatusAction`, new `addVendorFromBookAction`)
- Modify: `lib/actions/inquiries.ts` (`updateInquiryAction`, after its `db.$transaction`)
- Create: `components/vendor-book-card.tsx`
- Modify: `app/(workspace)/events/[id]/(outreach)/outreach/page.tsx`
- Test: `tests/unit/vendor-book.test.ts`

**Interfaces:**
- Consumes: from Task 1, `VendorContact` (compound unique `ownerId_listingId`) and `EventCollaborator.vendorContactId`.
- Produces:
  - `rememberCollaborator(collaboratorId: string): Promise<void>`
  - `rememberBookedListing(eventId: string, listingId: string): Promise<void>`
  - `vendorBookFor(ownerId: string): Promise<VendorBookEntry[]>`, where `VendorBookEntry = { id: string; name: string; kind: CollaboratorKind | null; category: ListingCategory | null; email: string | null; phone: string | null; website: string | null; listingId: string | null }`
  - `addVendorToEvent(eventId: string, ownerId: string, vendorContactId: string): Promise<boolean>`
  - `addVendorFromBookAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/vendor-book.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collabFind: vi.fn(),
  collabUpdate: vi.fn(),
  collabCreate: vi.fn(),
  eventFind: vi.fn(),
  listingFind: vi.fn(),
  vendorFindFirst: vi.fn(),
  vendorCreate: vi.fn(),
  vendorUpsert: vi.fn(),
  vendorFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    eventCollaborator: { findUnique: mocks.collabFind, update: mocks.collabUpdate, create: mocks.collabCreate },
    event: { findUnique: mocks.eventFind },
    listing: { findUnique: mocks.listingFind },
    vendorContact: {
      findFirst: mocks.vendorFindFirst,
      create: mocks.vendorCreate,
      upsert: mocks.vendorUpsert,
      findMany: mocks.vendorFindMany,
    },
  },
}));

import { addVendorToEvent, rememberBookedListing, rememberCollaborator } from "@/lib/vendor-book";

beforeEach(() => vi.clearAllMocks());

const COLLAB = {
  id: "col-1",
  kind: "VENUE",
  name: "The Foundry",
  email: "hi@foundry.com",
  phone: null,
  website: "https://foundry.com",
  vendorContactId: null,
  event: { ownerId: "host-1" },
};

describe("rememberCollaborator", () => {
  it("adds a confirmed venue to the host's vendor book and links it", async () => {
    mocks.collabFind.mockResolvedValue(COLLAB);
    mocks.vendorFindFirst.mockResolvedValue(null);
    mocks.vendorCreate.mockResolvedValue({ id: "v-1" });

    await rememberCollaborator("col-1");

    expect(mocks.vendorCreate.mock.calls[0][0].data).toMatchObject({
      ownerId: "host-1",
      kind: "VENUE",
      name: "The Foundry",
      email: "hi@foundry.com",
      website: "https://foundry.com",
    });
    expect(mocks.collabUpdate).toHaveBeenCalledWith({ where: { id: "col-1" }, data: { vendorContactId: "v-1" } });
  });

  it("reuses an existing entry with the same kind and name, ignoring case", async () => {
    mocks.collabFind.mockResolvedValue({ ...COLLAB, name: "the foundry" });
    mocks.vendorFindFirst.mockResolvedValue({ id: "v-old" });

    await rememberCollaborator("col-1");

    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    const where = mocks.vendorFindFirst.mock.calls[0][0].where;
    expect(where).toEqual({ ownerId: "host-1", kind: "VENUE", name: { equals: "the foundry", mode: "insensitive" } });
    expect(mocks.collabUpdate).toHaveBeenCalledWith({ where: { id: "col-1" }, data: { vendorContactId: "v-old" } });
  });

  it("does nothing when the event has no owner", async () => {
    mocks.collabFind.mockResolvedValue({ ...COLLAB, event: { ownerId: null } });
    await rememberCollaborator("col-1");
    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    expect(mocks.collabUpdate).not.toHaveBeenCalled();
  });
});

describe("rememberBookedListing", () => {
  it("upserts one entry per host and listing", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: "host-1" });
    mocks.listingFind.mockResolvedValue({ id: "lst-1", name: "Sol Catering", category: "CATERING" });

    await rememberBookedListing("evt-1", "lst-1");

    expect(mocks.vendorUpsert).toHaveBeenCalledWith({
      where: { ownerId_listingId: { ownerId: "host-1", listingId: "lst-1" } },
      create: { ownerId: "host-1", listingId: "lst-1", name: "Sol Catering", category: "CATERING" },
      update: {},
    });
  });
});

describe("addVendorToEvent", () => {
  it("adds a hand-entered vendor as a pending collaborator linked to the book", async () => {
    mocks.vendorFindFirst.mockResolvedValue({
      id: "v-1",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: "lee@x.com",
      phone: null,
      website: null,
      listingId: null,
    });

    expect(await addVendorToEvent("evt-2", "host-1", "v-1")).toBe(true);
    expect(mocks.vendorFindFirst.mock.calls[0][0].where).toEqual({ id: "v-1", ownerId: "host-1" });
    expect(mocks.collabCreate.mock.calls[0][0].data).toMatchObject({
      eventId: "evt-2",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: "lee@x.com",
      status: "PENDING",
      vendorContactId: "v-1",
    });
  });

  it("refuses another host's entry and catalog entries", async () => {
    mocks.vendorFindFirst.mockResolvedValue(null);
    expect(await addVendorToEvent("evt-2", "host-1", "v-foreign")).toBe(false);
    mocks.vendorFindFirst.mockResolvedValue({ id: "v-2", kind: null, name: "Sol", listingId: "lst-1" });
    expect(await addVendorToEvent("evt-2", "host-1", "v-2")).toBe(false);
    expect(mocks.collabCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/vendor-book.test.ts`
Expected: FAIL with `Cannot find module '@/lib/vendor-book'`.

- [ ] **Step 3: Implement `lib/vendor-book.ts`**

```ts
import type { CollaboratorKind, ListingCategory } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type VendorBookEntry = {
  id: string;
  name: string;
  kind: CollaboratorKind | null;
  category: ListingCategory | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  listingId: string | null;
};

/**
 * A venue, speaker or cohost was confirmed: put them in the host's vendor book
 * (matching an existing entry of the same kind and name, any case) and link
 * the collaborator to it.
 */
export async function rememberCollaborator(collaboratorId: string): Promise<void> {
  const collab = await db.eventCollaborator.findUnique({
    where: { id: collaboratorId },
    select: {
      id: true,
      kind: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      vendorContactId: true,
      event: { select: { ownerId: true } },
    },
  });
  const ownerId = collab?.event.ownerId;
  if (!collab || !ownerId || collab.vendorContactId) return;

  const existing = await db.vendorContact.findFirst({
    where: { ownerId, kind: collab.kind, name: { equals: collab.name, mode: "insensitive" } },
    select: { id: true },
  });
  const entry =
    existing ??
    (await db.vendorContact.create({
      data: {
        ownerId,
        kind: collab.kind,
        name: collab.name,
        email: collab.email,
        phone: collab.phone,
        website: collab.website,
      },
      select: { id: true },
    }));
  await db.eventCollaborator.update({ where: { id: collab.id }, data: { vendorContactId: entry.id } });
}

/** A catalog vendor was booked: one vendor-book entry per host and listing. */
export async function rememberBookedListing(eventId: string, listingId: string): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event?.ownerId) return;
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true, name: true, category: true },
  });
  if (!listing) return;
  await db.vendorContact.upsert({
    where: { ownerId_listingId: { ownerId: event.ownerId, listingId: listing.id } },
    create: { ownerId: event.ownerId, listingId: listing.id, name: listing.name, category: listing.category },
    update: {},
  });
}

/** Everyone in the host's vendor book, alphabetically. */
export async function vendorBookFor(ownerId: string): Promise<VendorBookEntry[]> {
  return db.vendorContact.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, category: true, email: true, phone: true, website: true, listingId: true },
  });
}

/**
 * Adds a hand-entered vendor-book entry to an event as a PENDING collaborator.
 * Only the owner's own entries, and only venue/speaker/cohost ones. Catalog
 * vendors go through their listing's inquiry flow instead.
 */
export async function addVendorToEvent(eventId: string, ownerId: string, vendorContactId: string): Promise<boolean> {
  const entry = await db.vendorContact.findFirst({ where: { id: vendorContactId, ownerId } });
  if (!entry || !entry.kind) return false;
  await db.eventCollaborator.create({
    data: {
      eventId,
      kind: entry.kind,
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      website: entry.website,
      status: "PENDING",
      source: "MANUAL",
      vendorContactId: entry.id,
    },
  });
  return true;
}
```

If `db.eventCollaborator.create` rejects `source: "MANUAL"`, open `enum CollaboratorSource` in `prisma/schema.prisma`, use the value that marks host-entered rows, and change the test's `toMatchObject` only if it asserts on `source` (it doesn't).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/vendor-book.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Hook the two choke points and add the action**

In `lib/actions/collaborators.ts`:
- Import `import { addVendorToEvent, rememberCollaborator } from "@/lib/vendor-book";`.
- In `setCollaboratorStatusAction`, inside the existing `if (before && status === "CONFIRMED" && before.status !== "CONFIRMED") { … }` block, after the `record(...)` call, add `await rememberCollaborator(collaboratorId);`.
- Append:

```ts
/** Adds someone from the host's vendor book to this event. */
export async function addVendorFromBookAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const vendorContactId = String(formData.get("vendorContactId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.ownerId || !vendorContactId) return;
  await addVendorToEvent(event.id, event.ownerId, vendorContactId);
  refresh();
}
```

`requireEvent` and `refresh` are already imported in this file. Check the import list, and add them if they aren't.

In `lib/actions/inquiries.ts`, import `rememberBookedListing` from `@/lib/vendor-book`. Directly after the `await db.$transaction(async (tx) => { … });` in `updateInquiryAction` closes, add:

```ts
  if (status === "BOOKED" && inquiry.status !== "BOOKED") {
    await rememberBookedListing(eventId, inquiry.listingId);
  }
```

- [ ] **Step 6: The vendor book card**

Create `components/vendor-book-card.tsx`:

```tsx
import Link from "next/link";
import { addVendorFromBookAction } from "@/lib/actions/collaborators";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { Button, Card } from "@/components/ui";
import type { VendorBookEntry } from "@/lib/vendor-book";

const KIND_LABEL = { VENUE: "Venue", SPEAKER: "Speaker", COHOST: "Cohost" } as const;

/** Vendors and venues this host has worked with, one click from this event. */
export function VendorBookCard({ eventId, entries }: { eventId: string; entries: VendorBookEntry[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Your vendor book</h2>
      <p className="mt-0.5 text-[13px] text-ink-mute">Venues and vendors you’ve confirmed or booked before.</p>
      <ul className="mt-3 divide-y divide-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink">{entry.name}</p>
              <p className="text-[12px] text-ink-mute">
                {entry.kind ? KIND_LABEL[entry.kind] : entry.category ? CATEGORY_LABEL[entry.category] : "Vendor"}
                {entry.email ? ` · ${entry.email}` : ""}
              </p>
            </div>
            {entry.kind ? (
              <form action={addVendorFromBookAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="vendorContactId" value={entry.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Add to this event
                </Button>
              </form>
            ) : entry.listingId ? (
              <Link href={`/listings/${entry.listingId}`} className="text-sm font-medium text-clay hover:underline">
                Ask again
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

`CATEGORY_LABEL` is already exported from `lib/catalog.ts` (`lib/plan.ts` imports it) and keyed by `ListingCategory`.

In `app/(workspace)/events/[id]/(outreach)/outreach/page.tsx`, import `vendorBookFor` from `@/lib/vendor-book` and `VendorBookCard` from `@/components/vendor-book-card`. After `const { event, user } = await requireEvent(id);`, add:

```ts
  const vendorBook = event.ownerId ? await vendorBookFor(event.ownerId) : [];
```

Directly before `{SECTIONS.map((section) => {`, add:

```tsx
      {vendorBook.length > 0 ? <VendorBookCard eventId={event.id} entries={vendorBook} /> : null}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck`, then `npx eslint lib/vendor-book.ts lib/actions/collaborators.ts lib/actions/inquiries.ts components/vendor-book-card.tsx "app/(workspace)/events/[id]/(outreach)/outreach/page.tsx"`, then `npm test`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add lib/vendor-book.ts lib/actions/collaborators.ts lib/actions/inquiries.ts components/vendor-book-card.tsx "app/(workspace)/events/[id]/(outreach)/outreach/page.tsx" tests/unit/vendor-book.test.ts
git commit -m "Keep a vendor book and add past vendors to a new event."
```

---

### Task 4: Run it again, and series

**Files:**
- Create: `lib/run-again.ts`
- Create: `lib/actions/run-again.ts`
- Create: `app/(workspace)/events/[id]/run-again/page.tsx`
- Modify: `components/workspace-bar.tsx` (a "Run it again" link next to "Event page ↗")
- Create: `app/(app)/series/[id]/page.tsx`
- Modify: `app/(workspace)/events/[id]/page.tsx` (series link)
- Test: `tests/unit/run-again.test.ts`, `tests/unit/run-again-action.test.ts`

**Interfaces:**
- Consumes: from Task 1, `Series`, `Event.seriesId` and `Event.copiedFromId`. From Task 3, `EventCollaborator.vendorContactId`. It also uses `DAY_MS` and `startOfDay` from `lib/plan.ts`.
- Produces:
  - `planRerun(source: RerunSource, date: Date): RerunPlan`, which is pure
  - `runEventAgain(sourceId: string, date: Date): Promise<string>`, which returns the new event id
  - `runAgainAction(formData: FormData): Promise<void>`, which reads `eventId` and `date` (`YYYY-MM-DDTHH:mm`) and redirects to the new event

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/run-again.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const tx = {
    event: { findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    series: { create: vi.fn() },
    budgetCategory: { createMany: vi.fn() },
    task: { createMany: vi.fn() },
    runSheetItem: { createMany: vi.fn() },
    eventCollaborator: { createMany: vi.fn() },
  };
  return { tx };
});

vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (tx: unknown) => unknown) => fn(hoisted.tx) },
}));

import { planRerun, runEventAgain, type RerunSource } from "@/lib/run-again";

const DAY = 86_400_000;
const { tx } = hoisted;

const SOURCE: RerunSource = {
  id: "evt-1",
  ownerId: "host-1",
  seriesId: null,
  title: "Thursday Pitch Night",
  type: "MIXER",
  kind: "pitch night",
  date: new Date("2026-10-01T19:00:00Z"),
  durationHours: 3,
  guestCount: 60,
  city: "Boston, MA",
  address: "100 Cambridge St",
  lat: 42.36,
  lng: -71.06,
  budgetTotalCents: 150_000,
  vibe: "Loud",
  description: "Five pitches, one winner.",
  ticketType: "FREE",
  ticketPriceCents: 0,
  visibility: "UNLISTED",
  requiresApproval: false,
  coverUrl: null,
  schoolDomain: "babson.edu",
  clubId: null,
  budgetCategories: [{ category: "CATERING", name: "Food", allocatedCents: 90_000, source: "GENERATED" }],
  tasks: [{ title: "Book the room", notes: null, offsetDays: 14, category: "VENUE", source: "GENERATED" }],
  runSheetItems: [
    { startsAt: new Date("2026-10-01T18:30:00Z"), title: "Doors", owner: "Sam", notes: null, source: "GENERATED" },
  ],
  collaborators: [
    {
      kind: "VENUE",
      name: "The Foundry",
      email: "hi@foundry.com",
      phone: null,
      website: null,
      detail: null,
      source: "MANUAL",
      externalId: null,
      lat: null,
      lng: null,
      vendorContactId: "v-1",
    },
  ],
};

describe("planRerun", () => {
  const date = new Date("2026-11-05T19:00:00Z");
  const plan = planRerun(SOURCE, date);

  it("copies the brief onto a new unpublished draft at the new date, pointing back at the source", () => {
    expect(plan.event).toMatchObject({
      ownerId: "host-1",
      title: "Thursday Pitch Night",
      kind: "pitch night",
      date,
      durationHours: 3,
      guestCount: 60,
      city: "Boston, MA",
      budgetTotalCents: 150_000,
      description: "Five pitches, one winner.",
      visibility: "UNLISTED",
      copiedFromId: "evt-1",
    });
    expect(plan.event).not.toHaveProperty("published");
    expect(plan.event).not.toHaveProperty("claimToken");
  });

  it("copies the budget split and re-dates tasks from their offset", () => {
    expect(plan.budgetCategories).toEqual([
      { category: "CATERING", name: "Food", allocatedCents: 90_000, source: "GENERATED" },
    ]);
    expect(plan.tasks[0]).toMatchObject({ title: "Book the room", offsetDays: 14, status: "TODO" });
    expect(plan.tasks[0].dueDate.getTime()).toBeLessThanOrEqual(date.getTime() - 13 * DAY);
  });

  it("shifts run-sheet items by the gap between the two dates", () => {
    expect(plan.runSheetItems[0].startsAt.toISOString()).toBe("2026-11-05T18:30:00.000Z");
  });

  it("brings vendors back as pending, still linked to the vendor book", () => {
    expect(plan.collaborators[0]).toMatchObject({ kind: "VENUE", name: "The Foundry", status: "PENDING", vendorContactId: "v-1" });
  });

  it("keeps run-sheet times of day when the source had no date", () => {
    const undated = planRerun({ ...SOURCE, date: null }, date);
    const startsAt = undated.runSheetItems[0].startsAt;
    expect(startsAt.getUTCHours()).toBe(18);
    expect(startsAt.getUTCMinutes()).toBe(30);
    expect(startsAt.toISOString().slice(0, 10)).toBe("2026-11-05");
  });
});

describe("runEventAgain", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses the source's series instead of creating another", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...SOURCE, seriesId: "series-1" });
    tx.event.create.mockResolvedValue({ id: "evt-new" });

    const id = await runEventAgain("evt-1", new Date("2026-11-05T19:00:00Z"));

    expect(id).toBe("evt-new");
    expect(tx.series.create).not.toHaveBeenCalled();
    expect(tx.event.create.mock.calls[0][0].data.seriesId).toBe("series-1");
  });

  it("starts a series named after the event the first time", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(SOURCE);
    tx.series.create.mockResolvedValue({ id: "series-new" });
    tx.event.create.mockResolvedValue({ id: "evt-new" });

    await runEventAgain("evt-1", new Date("2026-11-05T19:00:00Z"));

    expect(tx.series.create).toHaveBeenCalledWith({ data: { ownerId: "host-1", name: "Thursday Pitch Night" } });
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "evt-1" }, data: { seriesId: "series-new" } });
    expect(tx.event.create.mock.calls[0][0].data.seriesId).toBe("series-new");
  });
});
```

Create `tests/unit/run-again-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  runEventAgain: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("@/lib/run-again", () => ({ runEventAgain: mocks.runEventAgain }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { runAgainAction } from "@/lib/actions/run-again";

function form(eventId: string, date: string) {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("date", date);
  return data;
}

describe("runAgainAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks access, runs the event again and opens the copy", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: "host-1" } });
    mocks.runEventAgain.mockResolvedValue("evt-2");

    await expect(runAgainAction(form("evt-1", "2026-11-05T19:00"))).rejects.toThrow("REDIRECT /events/evt-2");
    expect(mocks.requireEvent).toHaveBeenCalledWith("evt-1");
    expect(mocks.runEventAgain.mock.calls[0][0]).toBe("evt-1");
    expect(mocks.runEventAgain.mock.calls[0][1]).toBeInstanceOf(Date);
  });

  it("refuses a missing or unreadable date", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: "host-1" } });
    await expect(runAgainAction(form("evt-1", "not-a-date"))).rejects.toThrow("REDIRECT /events/evt-1/run-again?error=date");
    expect(mocks.runEventAgain).not.toHaveBeenCalled();
  });

  it("refuses an event with no host", async () => {
    mocks.requireEvent.mockResolvedValue({ event: { id: "evt-1", ownerId: null } });
    await expect(runAgainAction(form("evt-1", "2026-11-05T19:00"))).rejects.toThrow();
    expect(mocks.runEventAgain).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/run-again.test.ts tests/unit/run-again-action.test.ts`
Expected: FAIL with `Cannot find module '@/lib/run-again'`.

- [ ] **Step 3: Implement `lib/run-again.ts` and the action**

Create `lib/run-again.ts`:

```ts
import type {
  CollaboratorKind,
  CollaboratorSource,
  EventType,
  EventVisibility,
  ListingCategory,
  RowSource,
  TicketType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { DAY_MS, startOfDay } from "@/lib/plan";

export type RerunSource = {
  id: string;
  ownerId: string | null;
  seriesId: string | null;
  title: string;
  type: EventType;
  kind: string | null;
  date: Date | null;
  durationHours: number;
  guestCount: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  budgetTotalCents: number;
  vibe: string | null;
  description: string | null;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  requiresApproval: boolean;
  coverUrl: string | null;
  schoolDomain: string | null;
  clubId: string | null;
  budgetCategories: { category: ListingCategory; name: string; allocatedCents: number; source: RowSource }[];
  tasks: { title: string; notes: string | null; offsetDays: number; category: ListingCategory | null; source: RowSource }[];
  runSheetItems: { startsAt: Date; title: string; owner: string | null; notes: string | null; source: RowSource }[];
  collaborators: {
    kind: CollaboratorKind;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    detail: string | null;
    source: CollaboratorSource;
    externalId: string | null;
    lat: number | null;
    lng: number | null;
    vendorContactId: string | null;
  }[];
};

export type RerunPlan = ReturnType<typeof planRerun>;

/** Moves a run-sheet time onto the new day: by the date gap, or, with no source date, keeping its time of day. */
function shiftTime(at: Date, from: Date | null, to: Date): Date {
  if (from) return new Date(at.getTime() + (to.getTime() - from.getTime()));
  const moved = new Date(to);
  moved.setUTCHours(at.getUTCHours(), at.getUTCMinutes(), 0, 0);
  return moved;
}

/**
 * What "Run it again" writes, worked out without touching the database: the
 * brief, the budget split, the tasks (re-dated, back to TODO), the run sheet
 * (shifted) and the vendors (back to PENDING). Guests, inquiries, budget
 * items, blasts and the outcome stay with the original night.
 */
export function planRerun(source: RerunSource, date: Date) {
  return {
    event: {
      ownerId: source.ownerId,
      title: source.title,
      type: source.type,
      kind: source.kind,
      date,
      durationHours: source.durationHours,
      guestCount: source.guestCount,
      city: source.city,
      address: source.address,
      lat: source.lat,
      lng: source.lng,
      budgetTotalCents: source.budgetTotalCents,
      vibe: source.vibe,
      description: source.description,
      ticketType: source.ticketType,
      ticketPriceCents: source.ticketPriceCents,
      visibility: source.visibility,
      requiresApproval: source.requiresApproval,
      coverUrl: source.coverUrl,
      schoolDomain: source.schoolDomain,
      clubId: source.clubId,
      copiedFromId: source.id,
    },
    budgetCategories: source.budgetCategories.map((c) => ({
      category: c.category,
      name: c.name,
      allocatedCents: c.allocatedCents,
      source: c.source,
    })),
    tasks: source.tasks.map((t) => ({
      title: t.title,
      notes: t.notes,
      offsetDays: t.offsetDays,
      category: t.category,
      source: t.source,
      status: "TODO" as const,
      dueDate: startOfDay(new Date(date.getTime() - t.offsetDays * DAY_MS)),
    })),
    runSheetItems: source.runSheetItems.map((r) => ({
      title: r.title,
      owner: r.owner,
      notes: r.notes,
      source: r.source,
      startsAt: shiftTime(r.startsAt, source.date, date),
    })),
    collaborators: source.collaborators.map((c) => ({
      kind: c.kind,
      name: c.name,
      email: c.email,
      phone: c.phone,
      website: c.website,
      detail: c.detail,
      source: c.source,
      externalId: c.externalId,
      lat: c.lat,
      lng: c.lng,
      vendorContactId: c.vendorContactId,
      status: "PENDING" as const,
    })),
  };
}

/**
 * Runs an event again on a new date: copies it, puts both in one series
 * (creating it, named after the event, the first time) and returns the new id.
 */
export async function runEventAgain(sourceId: string, date: Date): Promise<string> {
  return db.$transaction(async (tx) => {
    const source = await tx.event.findUniqueOrThrow({
      where: { id: sourceId },
      include: { budgetCategories: true, tasks: true, runSheetItems: true, collaborators: true },
    });
    if (!source.ownerId) throw new Error("Only an event with a host can be run again.");

    let seriesId = source.seriesId;
    if (!seriesId) {
      const series = await tx.series.create({ data: { ownerId: source.ownerId, name: source.title } });
      seriesId = series.id;
      await tx.event.update({ where: { id: source.id }, data: { seriesId } });
    }

    const plan = planRerun(source, date);
    const created = await tx.event.create({ data: { ...plan.event, seriesId }, select: { id: true } });
    const eventId = created.id;
    if (plan.budgetCategories.length) {
      await tx.budgetCategory.createMany({ data: plan.budgetCategories.map((c) => ({ ...c, eventId })) });
    }
    if (plan.tasks.length) await tx.task.createMany({ data: plan.tasks.map((t) => ({ ...t, eventId })) });
    if (plan.runSheetItems.length) {
      await tx.runSheetItem.createMany({ data: plan.runSheetItems.map((r) => ({ ...r, eventId })) });
    }
    if (plan.collaborators.length) {
      await tx.eventCollaborator.createMany({ data: plan.collaborators.map((c) => ({ ...c, eventId })) });
    }
    return eventId;
  });
}
```

Create `lib/actions/run-again.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { runEventAgain } from "@/lib/run-again";
import { requireEvent } from "@/lib/session";

/** Copies an event onto a new date and opens the copy. Public endpoint: requireEvent checks access. */
export async function runAgainAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  if (!event.ownerId) throw new Error("Only an event with a host can be run again.");
  const raw = String(formData.get("date") ?? "");
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) redirect(`/events/${event.id}/run-again?error=date`);
  const copyId = await runEventAgain(event.id, date);
  redirect(`/events/${copyId}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/run-again.test.ts tests/unit/run-again-action.test.ts`
Expected: PASS (7 + 3 tests).

- [ ] **Step 5: The pages and the entry points**

Create `app/(workspace)/events/[id]/run-again/page.tsx`:

```tsx
import { runAgainAction } from "@/lib/actions/run-again";
import { requireEvent } from "@/lib/session";
import { Button, Card, Field, Input } from "@/components/ui";

export const metadata = { title: "Run it again" };

const DAY_MS = 86_400_000;

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in UTC like the rest of the brief. */
function inputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}

/** Pick the new date; everything else comes from this event. */
export default async function RunAgainPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/run-again">) {
  const { id } = await params;
  const { error } = await searchParams;
  const { event } = await requireEvent(id);
  const suggested = new Date((event.date ?? new Date()).getTime() + 7 * DAY_MS);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-2">
      <h1 className="font-display text-[26px] text-ink">Run “{event.title}” again</h1>
      <p className="text-[15px] text-ink-soft">
        The new draft keeps the brief, budget split, vendors and run sheet. Guests aren’t copied: invite them from your
        guest book.
      </p>
      <Card className="p-5">
        <form action={runAgainAction} className="space-y-4">
          <input type="hidden" name="eventId" value={event.id} />
          <Field label="New date and start time" error={error === "date" ? "Pick a date and time." : undefined}>
            <Input type="datetime-local" name="date" required defaultValue={inputValue(suggested)} />
          </Field>
          <Button type="submit">Create the new draft</Button>
        </form>
      </Card>
    </div>
  );
}
```

Before using them, check `components/ui.tsx` for the `Field` props (`label`, `error`, children). Also check how `PageProps` types `searchParams` in this Next version (`node_modules/next/dist/docs/`). If `searchParams` values are `string | string[]`, read `error` with `typeof error === "string" ? error : undefined`.

In `components/workspace-bar.tsx`, next to the existing `<ButtonLink href={`/e/${event.id}`} variant="secondary" size="sm">Event page ↗</ButtonLink>`, add:

```tsx
            <ButtonLink href={`/events/${event.id}/run-again`} variant="secondary" size="sm">
              Run it again
            </ButtonLink>
```

Put it in the same wrapper, so it inherits the same responsive visibility.

Create `app/(app)/series/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Every night in one series, newest first, with how many came. Owner only. */
export default async function SeriesPage({ params }: PageProps<"/series/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/series/${id}`);
  const series = await db.series.findFirst({
    where: { id, ownerId: user.id },
    include: {
      events: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          date: true,
          outcome: { select: { checkedIn: true } },
          _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
        },
      },
    },
  });
  if (!series) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <p className="text-[13px] font-medium text-ink-mute">Series</p>
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">{series.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {series.events.length} {series.events.length === 1 ? "night" : "nights"}
      </p>
      <Card className="mt-6 divide-y divide-line overflow-hidden">
        {series.events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-sunk">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{e.title}</span>
              <span className="block text-[13px] text-ink-mute">{e.date ? WHEN.format(e.date) : "No date yet"}</span>
            </span>
            <span className="text-[13px] text-ink-soft">
              {e.outcome ? `${e.outcome.checkedIn} came` : `${e._count.guests} going`}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
```

In `app/(workspace)/events/[id]/page.tsx`, load the series name. After the page loads its `event`, add `const series = event.seriesId ? await db.series.findUnique({ where: { id: event.seriesId }, select: { id: true, name: true } }) : null;`. Import `db` from `@/lib/db` if it isn't imported already. If the page's event query uses an explicit `select`, add `seriesId: true` to it. Directly above the first card of the page body, render:

```tsx
      {series ? (
        <p className="text-[13px] text-ink-mute">
          Part of{" "}
          <Link href={`/series/${series.id}`} className="font-medium text-clay hover:underline">
            {series.name}
          </Link>
        </p>
      ) : null}
```

Import `Link` from `next/link` if it isn't already imported.

- [ ] **Step 6: Verify**

Run: `npx next typegen` (for the new routes), then `npm run typecheck`, then `npx eslint lib/run-again.ts lib/actions/run-again.ts "app/(workspace)/events/[id]/run-again/page.tsx" components/workspace-bar.tsx "app/(app)/series/[id]/page.tsx" "app/(workspace)/events/[id]/page.tsx"`, then `npm test`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add lib/run-again.ts lib/actions/run-again.ts "app/(workspace)/events/[id]/run-again/page.tsx" components/workspace-bar.tsx "app/(app)/series/[id]/page.tsx" "app/(workspace)/events/[id]/page.tsx" tests/unit/run-again.test.ts tests/unit/run-again-action.test.ts
git commit -m "Run an event again on a new date, and group repeats into a series."
```

---

### Task 5: Ship and check

**Files:** none unless the check finds a defect.

- [ ] **Step 1:** Run `git push no-mistakes <branch>` and drive the run to `checks-passed`. Take any `ask-user` finding to the user word for word.
- [ ] **Step 2:** On production, after the user says to merge, signed in as Maya (seeded events have guests):
  - **Run it again:** open an event, click "Run it again" and create the draft. The copy has the brief, budget, tasks, run sheet and vendors (pending), and no guests. Both events link to the same series page.
  - **Guest book:** on the copy's Guests tab, "From your guest book" lists people who came to Maya's other events. Inviting two of them adds exactly two guests.
  - **Vendor book:** confirm a venue on Outreach, then open another event's Outreach. The venue is in "Your vendor book", and "Add to this event" adds it as pending.
