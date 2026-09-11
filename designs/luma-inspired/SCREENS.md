# Screen specs (wireframe level)

Specs for implementation and for reading the HTML mocks. Layouts are HostKit; flows follow publicly documented event-platform patterns (create fields, manage tabs, guest filters, insights). Sample event: **Rooftop Jazz Night**.

Prototype rule: every mock shows a top banner — `DESIGN PROTOTYPE — HostKit · sample data · not production`.

---

## 1. Discover / home

**Goal.** Hosts land on their nights; guests (logged out) browse public sample events.

```
┌─────────────────────────────────────────────────────────────┐
│ [PROTO]                                                     │
│ HostKit          Discover    [Sign in]  [Plan an event]     │
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

**Mobile.** Cards stack. Create is sticky bottom clay bar.

---

## 2. Create event

**Goal.** Publish a public (or unlisted) night *and* seed HostKit’s plan (type, headcount, city, budget).

```
┌─────────────────────────────────────────────────────────────┐
│ HostKit     Creating event              [Save draft][Publish]│
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
│ HostKit plan                  │                             │
│ Type chips · Headcount · City │                             │
│ Budget $                      │                             │
│                               │                             │
│ Theme  5 family rows, 42 dots │                             │
│ Calendar [The Lantern Sessions]                             │
│ Visibility  Public / Unlisted / Calendar members            │
│ Registration  Approval? Capacity [90] Waitlist [on]         │
└───────────────────────────────┴─────────────────────────────┘
```

**Validation.** Title + start time required to Publish. Location required if In person. Meeting link required if Online. Budget is optional but recommended (HostKit copy: “used to price venues against this night”).

**Primary vs secondary.** Publish = clay. Draft = secondary.

---

## 3. Event public page

**Goal.** A guest understands the night in five seconds and can register.

```
┌──────────────────────────────────────────┬──────────────────┐
│ Cover (full width of column, radius-card)│ Register card    │
│ Overline PUBLIC · IN PERSON              │ sticky           │
│ Display Rooftop Jazz Night               │ Fri 18 Sep       │
│ Host Maya Chen · The Lantern Sessions    │ 7:30–10:30 PM    │
│                                          │ PDT              │
│ When  Friday, September 18, 2026         │ The Lantern Roof │
│       7:30 PM – 10:30 PM PDT             │ Oakland          │
│ Where The Lantern Roof, 12th St          │                  │
│       [Open map]                         │ 86 / 90 going    │
│                                          │ [Register]       │
│ Body  rich description…                  │ or waitlist      │
│                                          │ Add to calendar  │
│ Share copy link · ICS                    │                  │
└──────────────────────────────────────────┴──────────────────┘
```

**Theme.** Midnight Garden: `night` ground, clay register button, Fraunces title in `night-ink`.

**Mobile.** Register card becomes a sticky footer (title + clay button). Cover first.

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
│ What this event still needs (HostKit) Next up (tasks)       │
│  Venue Booked · Catering Waiting…     timeline excerpts     │
│                                                             │
│ Recent activity (regs, declines, views)                     │
└─────────────────────────────────────────────────────────────┘
```

**HostKit-specific.** The coverage grid from today’s overview stays on this tab. Do not hide it under More.

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

**Goal.** Policy for how people join, without implying HostKit processes payments yet.

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

**Copy.** Paid tile: “HostKit tracks money; it doesn’t collect it yet.”

---

## 7. Blasts composer

**Goal.** Write one message to a segment; theme accent on the CTA.

```
┌────────────────────────────┬────────────────────────────────┐
│ To: [Going ▾]  86 people   │ Email preview (theme accent)   │
│ Subject [Doors at 7:15]    │ From: Maya · Rooftop Jazz      │
│ Body rich text             │ heading Fraunces               │
│ CTA label [Add to calendar]│ [clay button]                  │
│                            │ footer HostKit demo            │
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
│ HostKit · Jazz Night         │
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
