# Scope Lock: Recurring Hosts

Date: 2026-09-22. Status: decided by the product owner. This document is the authority for what Hosty builds next. Anything not listed under "In scope" waits until this document changes.

## The one user

**A recurring host** is someone who runs the same kind of event again and again, such as a monthly pitch night, a weekly run club social or a termly alumni dinner. Every design decision is judged by one question: *does this make the second, fifth and twentieth event faster than the first?*

One-off hosts can still use Hosty, but no work is done for them specifically. Guests and vendors never sign in (unchanged).

## In scope

1. **Access: waitlist plus admin approval.** Hosty stays invite-only. People join the waitlist. The administrator (`leowomc@gmail.com`) approves entries from `/admin/waitlist`. An approved person gets an email with a link to set a password, then has the full host app.
2. **An honest front door.** Nothing tells a stranger "free to start" or "no account needed". Signed-out visitors are offered "Join the waitlist" and "Sign in". Creating an event requires dashboard access, so there are no more anonymous drafts from the website.
3. **Recurring-host features** (plan 2, built on the data model below):
   - **Series:** link repeat events ("Thursday Pitch Night") with shared history.
   - **Run it again:** one action copies an event's brief, budget split, vendors and run sheet into a new draft with a new date. Guests aren't copied.
   - **Host guest book:** people who have attended any of the host's events, reusable ("invite everyone who came last time").
   - **Host vendor book:** vendors and venues the host has worked with, reusable across events.

## Frozen (kept working, no new work)

- **iOS app** (`ios/`, `app/api/v1/*` as it serves iOS). Bug fixes only.
- **Clubs** (club pages, follows, posts, club-owned events).
- **Discover and campus calendars** (`/discover`, `/campus`, `CampusEvent`, school imports).
- **Anonymous draft claiming** (`/events/claim`, `claimToken`). Existing claim links keep working for anyone with access. The website stops minting new anonymous drafts.

"Frozen" means no new features, copy or UI polish. Security and breakage fixes are allowed.

## Unchanged, not frozen

MCP server and AI connectors, the agent run, the admin page. These keep working and can get fixes. New features only when they serve recurring hosts.

## Data model

### Locked as-is

| Concept | Table(s) | Owns |
|---|---|---|
| Event | `Event` | One occurrence, with date, brief, budget, visibility and publish state |
| Guest | `Guest` | One person's RSVP to one event. Per-event by design. |
| Vendor, from Hosty's catalog | `Listing` + `Inquiry` | Catalog businesses, and the host's inquiry to one of them for one event |
| Vendor, entered by hand | `EventCollaborator` | Venue, vendor, speaker or cohost the host added to one event, with outreach status |
| Plan | `Task`, `BudgetCategory`, `BudgetItem`, `RunSheetItem` | The event's checklist, budget and day-of schedule |

### Messages: ownership is locked, no new message tables

| Message | Lives in | Direction |
|---|---|---|
| Update to guests (email or SMS) | `Blast` | Host to guests of one event |
| Inquiry to a catalog vendor | `Inquiry.message` | Host to a `Listing` |
| Outreach to a hand-entered vendor | `EventCollaborator.message` | Host to a collaborator |
| In-app notice | `Notification` | System to a user |

A new kind of message goes into one of these four, or this document changes first.

### Additions for recurring hosts (plan 2)

```prisma
/// A named run of repeat events owned by one host.
model Series {
  id        String   @id @default(cuid())
  ownerId   String
  name      String
  createdAt DateTime @default(now())
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  events    Event[]
  @@index([ownerId])
}
// Event gains: seriesId String? (onDelete: SetNull), copiedFromId String? (the event it was run again from)

/// A person in one host's guest book. Guests link here, so history survives across events.
model Contact {
  id        String   @id @default(cuid())
  ownerId   String
  name      String
  email     String?
  phone     String?
  createdAt DateTime @default(now())
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  guests    Guest[]
  @@unique([ownerId, email])
  @@index([ownerId])
}
// Guest gains: contactId String? (onDelete: SetNull)

/// A vendor or venue in one host's vendor book.
model VendorContact {
  id        String   @id @default(cuid())
  ownerId   String
  kind      CollaboratorKind
  name      String
  email     String?
  phone     String?
  website   String?
  listingId String?  // set when the vendor came from Hosty's catalog
  createdAt DateTime @default(now())
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  collaborators EventCollaborator[]
  @@index([ownerId, kind])
}
// EventCollaborator gains: vendorContactId String? (onDelete: SetNull)
```

Guests and collaborators stay per-event. The book entries are the host-level identity they link to, filled in automatically as events happen.

### Additions for access (plan 1)

```prisma
// User gains:           approvedAt DateTime?
// EmailListEntry gains: approvedAt DateTime?, userId String? @unique
```

Dashboard access = Maya, the administrator, or `approvedAt` set.

## Out of scope for now

Payments or ticket sales changes, vendor logins, guest accounts, new message channels, public host profiles, anything in the frozen list.
