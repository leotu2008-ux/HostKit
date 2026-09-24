# Screen specs (tablet / companion)

**Canonical phone frames live in [MOBILE.md](./MOBILE.md)** (390 × 844, bottom tabs). This file is the **wide layout** of the same product — useful for iPad or a future host companion. Do not implement the phone app from these wireframes.

Layouts are Hosty; flows follow publicly documented event-platform patterns (create fields, manage tabs, guest filters, insights). Sample event: **Rooftop Jazz Night**.

Prototype rule: every mock shows a top banner — `DESIGN PROTOTYPE — Hosty · sample data · not production`.

---

## 1. Discover / home

**Goal.** Hosts land on their nights; guests (logged out) browse public sample events.

```
┌─────────────────────────────────────────────────────────────┐
│ [PROTO]                                                     │
│ Hosty          Discover    [Sign in]  [Plan an event]     │
├─────────────────────────────────────────────────────────────┤
│ Overline: Your nights                                       │
│ Display: What are you hosting next?          [Create event] │
│                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ cover 16:9   │ │ cover        │ │ + New draft  │          │
│ │ Rooftop Jazz │ │ Harvest Supper│ │ dashed empty │          │
│ │ Fri 18 Sep   │ │ draft · edit  │ │              │          │
│ │ 86 going     │ │               │ │              │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                             │
│ Overline: Happening nearby · Oakland                        │
│ [search city / date / tag]                                  │
│ grid of public cards (title, date, host, spots)             │
└─────────────────────────────────────────────────────────────┘
```

**States.** Empty “Your nights”: Fraunces “No events yet” + clay **Create event**. Search no hits: “Nothing in that city this month.”

**Mobile (canonical).** See `MOBILE.md` — cards stack, bottom tabs, Create is the clay circle tab. Do not use a sticky bottom CTA that fights the tab bar.

**Live-site note (structure only).** luma.com Discover uses a compact nav, a dense “popular” list (thumb + date + place), category tiles with icons/counts, and followable calendars. Hosty’s host-home should **not** copy those icons or the Follow marketplace pattern. Optional later: a compact “Happening nearby” *list* variant under the card grid, using Hosty event types (Party, Concert, Dinner…) as text chips, not colorful line-icon tiles.

---

## 2. Create event

**Goal.** Publish a public (or unlisted) night *and* seed Hosty’s plan (type, headcount, city, budget).

```
┌─────────────────────────────────────────────────────────────┐
│ Hosty     Creating event              [Save draft][Publish]│
├───────────────────────────────┬─────────────────────────────┤
│ Title  [Rooftop Jazz Night  ] │ Sticky preview (public card)│
│                               │ ┌─────────────────────────┐ │
│ When                          │ │ cover treatment         │ │
│ [Fri 18 Sep] [19:30]–[22:30]  │ │ Rooftop Jazz Night      │ │
│ Timezone [America/Los_Angeles]│ │ Fri 18 Sep · 7:30 PM    │ │
│                               │ │ The Lantern Roof        │ │
│ Format  ( ) In person ( ) Onl.│ │ [Register]              │ │
│         (•) Hybrid            │ └─────────────────────────┘ │
│                               │ Theme: Midnight Garden      │
│ Cover   [Replace illustration]│ Visibility: Public          │
│                               │                             │
│ Where   venue search / paste  │                             │
│ Meeting [optional URL]        │                             │
│                               │                             │
│ Description  rich text        │                             │
│                               │                             │
│ Hosty plan                  │                             │
│ Type chips · Headcount · City │                             │
│ Budget $                      │                             │
│                               │                             │
│ Theme  5 family rows, 42 dots │                             │
│ Calendar [The Lantern Sessions]                             │
│ Visibility  Public / Unlisted / Calendar members            │
│ Registration  Approval? Capacity [90] Waitlist [on]         │
└───────────────────────────────┴─────────────────────────────┘
```

**Validation.** Title + start time required to Publish. Location required if In person. Meeting link required if Online. Budget is optional but recommended (Hosty copy: “used to price venues against this night”).

**Primary vs secondary.** Publish = clay. Draft = secondary.

---

## 3. Event public page

**Goal.** A guest understands the night in five seconds and can register.

```
┌──────────── cover ────────────┬─────────────────────────────┐
│ rounded-square illustration   │ Oakland · In person         │
│                               │ Display Rooftop Jazz Night  │
│ Hosted by Maya Chen           │ When  Fri 18 Sep, 7:30 PM   │
│ The Lantern Sessions          │ Where The Lantern Roof      │
│ Tags: Jazz · Rooftop          │                             │
│                               │ Registration card           │
│                               │ 86/90  [Register] clay      │
│                               │ About this night…           │
└───────────────────────────────┴─────────────────────────────┘
```

**Live-site note (structure only).** luma.com places cover + host on the **left** and serif title + when/where + Register + about on the **right**. Hosty reuses that split with Midnight Garden + clay — not cream + brown.

**Theme.** Midnight Garden: `night` ground, clay register button, Fraunces title in `night-ink`.

**Mobile (canonical).** See `MOBILE.md` guest view: cover first, then title, facts, host, tags, sticky Register footer. Hide host tabs.

**States.** Sold out → waitlist CTA. Private unlisted → same layout, no Discover indexing. Approval required → “Request to join”.

---

## 4. Manage Overview

**Goal.** One glance: will this night fill, and is the *plan* (venue, catering, etc.) still uncovered?

```
┌─────────────────────────────────────────────────────────────┐
│ Event chrome: thumb · title · date · Public · [Preview]     │
│ Overview | Guests | Registration | Blasts | Insights | More │
├─────────────────────────────────────────────────────────────┤
│ ┌ STAT ┐ ┌ STAT ┐ ┌ STAT ┐ ┌ STAT ┐                         │
│ │ 86   │ │ 4    │ │ 1,240│ │ 12   │                         │
│ │ Going│ │Pend. │ │Views │ │In    │                         │
│ └──────┘ └──────┘ └──────┘ └──────┘                         │
│                                                             │
│ Live pulse (sparkline, last 60 min)   Registration health   │
│  · 14 on page now                     90 cap · waitlist on  │
│                                       approval: 4 waiting   │
│                                                             │
│ What this event still needs (Hosty) Next up (tasks)       │
│  Venue Booked · Catering Waiting…     timeline excerpts     │
│                                                             │
│ Recent activity (regs, declines, views)                     │
└─────────────────────────────────────────────────────────────┘
```

**Hosty-specific.** The coverage grid from today’s overview stays on this tab. Do not hide it under More.

**Empty.** Event just created: stats at 0, empty activity, coverage all “Needed”, CTA Scout listings.

---

## 5. Guests table

**Goal.** Find someone, change status, bulk update, get people through the door.

```
┌─────────────────────────────────────────────────────────────┐
│ [Going 86] [Pending 4] [Waitlist 7] [Invited 12]            │
│ [Not going 3] [Checked in 12]                               │
│                                                             │
│ [Search name, email, domain]  Sort ▾                        │
│ [Approve] [Decline] [CSV update] [QR check-in] [Export]     │
├─────────────────────────────────────────────────────────────┤
│ ☐  Name            Email              Status     Guests     │
│ ☐  Taylor Kim      taylor@…           Checked in 1          │
│ ☐  Maya Chen       maya@lantern.test  Going      2          │
│ ☐  Jordan Blake    jordan@…           Pending    1  [✓][✕]  │
│ ☐  Priya Shah      priya@…            Waitlist   1          │
└─────────────────────────────────────────────────────────────┘
```

**Search.** Tokenize on whitespace; `gmail.com` matches domain; exact email preferred.

**Sort.** Name, recently registered, status, check-in time.

**Bulk CSV.** Download template; upload maps email → status. Preview diff before apply (spec only; mock shows the control).

**QR check-in.** Opens Check-in route (see §9), not a hidden modal-only flow.

---

## 6. Registration / tickets

**Goal.** Policy for how people join, without implying Hosty processes payments yet.

```
┌─────────────────────────────────────────────────────────────┐
│ Ticket types                     [Add type]                 │
│ ┌ Free admission ─┐ ┌ Request ──┐ ┌ Paid (soon) ─┐         │
│ │ $0 · 90 cap     │ │ approval  │ │ disabled, amber│        │
│ │ waitlist on     │ │ 4 pending │ │ “no payments”  │        │
│ └─────────────────┘ └───────────┘ └────────────────┘        │
│                                                             │
│ Capacity  [90]   Waitlist [x]   Plus-ones [1]               │
│ Questions: dietary, song request (optional)                 │
│ Approval: off | on for all | on when over 80%               │
└─────────────────────────────────────────────────────────────┘
```

**Copy.** Paid tile: “Hosty tracks money; it doesn’t collect it yet.”

---

## 7. Blasts composer

**Goal.** Write one message to a segment; theme accent on the CTA.

```
┌────────────────────────────┬────────────────────────────────┐
│ To: [Going ▾]  86 people   │ Email preview (theme accent)   │
│ Subject [Doors at 7:15]    │ From: Maya · Rooftop Jazz      │
│ Body rich text             │ heading Fraunces               │
│ CTA label [Add to calendar]│ [clay button]                  │
│                            │ footer Hosty demo            │
│ [Copy blast] [Download .eml]                                │
└────────────────────────────┴────────────────────────────────┘
```

**Segments.** Going, Pending, Waitlist, Invited, Not going, Checked in, everyone except not-going.

**Demo constraint.** No send. Same pattern as inquiry drafts.

---

## 8. Insights dashboard

**Goal.** Whether the page is being found, and whether people showed up.

```
┌─────────────────────────────────────────────────────────────┐
│ Range [Last 7 days ▾]                                       │
│ Page views 1,240   Unique 880   Live now 14                 │
│ [area chart — views by day]                                 │
│                                                             │
│ Top referrers        Cities           Sources (UTM)         │
│ instagram.com  410   Oakland  520     instagram  380        │
│ direct         290   SF       210     (none)     510        │
│ lantern.test   80    Berkeley 90      newsletter 90         │
│                                                             │
│ Referrals (hosts who shared)     Attendance                 │
│  Maya Chen  24 clicks            86 going · 12 in · 14%     │
└─────────────────────────────────────────────────────────────┘
```

**Empty.** “Publish to see traffic.” Chart shows dashed empty.

---

## 9. Check-in mobile

**Goal.** Door staff, one thumb, bright states.

```
┌──────────────────────────────┐
│ Hosty · Jazz Night         │
│ 12 checked in · 86 going     │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │     QR viewfinder        │ │
│ │                          │ │
│ └──────────────────────────┘ │
│ or search [name / email]     │
│                              │
│ Last: Taylor Kim  ✓ 7:12 PM  │
│                              │
│ Tap result → full screen:    │
│   GOING  forest              │
│   ALREADY IN  amber          │
│   NOT ON LIST  danger        │
└──────────────────────────────┘
```

**Viewport.** Design at 390×844. Hide manage tabs. Large type. Success haptic/flash forest.

**Offline.** Spec: last guest list cached; mock is online-happy-path only.

---

## Cross-screen states to keep consistent

| State | Treatment |
| --- | --- |
| Loading | Sunk pulse bars, no spinners in clay |
| Empty | Dashed card + Fraunces title + one clay action |
| Error | danger-wash inline, sentence case |
| Permission | Guests never see manage chrome |
| Prototype | Amber-wash banner, always visible in HTML mocks |
