# HostKit mobile app — screen specs (canonical)

**Product target is a phone app**, not a desktop-first web dashboard. Implement in **Expo / React Native** or a **mobile PWA**. Logical frame for every screen in this file: **390 × 844** (iPhone 14-class). Touch targets ≥ 44px. The Next.js demo in this repo is a planning prototype; these frames are the shipping UI.

Desktop HTML in `mockups/*.html` (without the `mobile-` prefix) is a **tablet / host-companion** reference only.

Inspired by public Luma event UX *patterns*. Branding is HostKit (paper, clay, Fraunces). Not affiliated with Luma.

Prototype banner sits **outside** the phone in HTML mocks so it doesn’t eat the 844px.

---

## Bottom tab shell

Four tabs, paper bar, 1px `line` on top, 64px content + 20px home-indicator safe area (84px total). Active label `ink` + clay mark. Inactive `ink-mute`. **Create** is a 48px clay circle *in* the bar (not a floating social-app FAB — it must not cover list rows).

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │  44 status
│ HostKit                      MC       │  52 header
│                                       │
│              (screen)                 │
│                                       │
│ Nights   ＋   Door   More              │  84 tab+safe
└───────────────────────────────────────┘
```

| Tab | Root | Selected when |
| --- | --- | --- |
| **Nights** | Discover / home | Discover, and Event detail (stack child) |
| **Create** | Create composer | Create |
| **Door** | Guests + check-in | Guests, Scan |
| **More** | Sheet: Plan, Budget, Scout, Run sheet, Account | More sheet open |

Guest-only deep links (public event, register) **hide the host tab bar** and use a sticky Register footer instead (see Event detail — guest mode). Hosts opening Preview stay in the app with a “Guest view” chrome, then **Manage** to return.

HTML: `mobile-discover.html`, `mobile-event.html`, `mobile-create.html`, `mobile-guests.html`.

---

## 1. Discover — Nights · `mobile-discover.html`

**Goal.** Thumb-reach: see your next night, or what’s nearby.

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │
│ HostKit                      MC       │
│                                       │
│ Overline  YOUR NIGHTS                 │
│ Display   What are you                │
│           hosting next?               │
│ Search    Oakland, Sep ▾              │
│                                       │
│ ┌─ cover 16:9 ─────────────────────┐  │
│ │  lantern wash                    │  │
│ │  Rooftop Jazz Night              │  │
│ │  Fri 18 · 86 going · Public      │  │
│ └──────────────────────────────────┘  │
│ ┌─ dashed ─┐  Harvest Supper · draft  │
│                                       │
│ HAPPENING NEARBY                      │
│ [Party] [Concert] [Dinner]  chips     │
│ • Golden Hour Picnic · Sat 19 · 24    │
│ • Harbor Listening · Sun 20 · 40      │
│                                       │
│ Nights   ＋   Door   More              │
└───────────────────────────────────────┘
```

**States.** Empty nights: Fraunces “No events yet” + clay **Create**. Nearby empty: “Nothing public in Oakland this week.”

**Gestures.** Pull to refresh. Card tap → Event detail. Long-press → Share / Duplicate (spec; not in mock).

---

## 2. Event detail · `mobile-event.html`

Two modes, one route. Host lands on **Manage**. **Guest view** is a toggle (and the standalone guest deep link).

### Host manage (tab: Nights)

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │
│ ← Nights     Rooftop Jazz      Share  │
│                                       │
│ ┌ cover ───────────────────────────┐  │
│ └──────────────────────────────────┘  │
│ Fri 18 Sep · 7:30 PM · Lantern Roof   │
│ Public · In person · 4 pending        │
│                                       │
│ [Guest view]  [Check in]              │
│                                       │
│  86 going   4 pending   1,240 views   │
│                                       │
│ STILL NEEDS                           │
│ Venue Booked · Catering Waiting       │
│ Music Needed · Bar Booked             │
│                                       │
│ NEXT UP                               │
│ Sep 14  Send parking blast            │
│                                       │
│ Nights   ＋   Door   More              │
└───────────────────────────────────────┘
```

Coverage stays on this screen (HostKit). Do not bury under More.

### Guest view (no host tabs)

Sticky footer: `86 / 90` + clay **Register**. Cover, Fraunces title, when/where rows, host block, tags, body. Midnight Garden tokens for Jazz Night. Same content as the desktop public mock, stacked.

---

## 3. Create · `mobile-create.html`

Single column. Preview is a **compact card at the top**, not a side rail. Sticky footer: **Save draft** (ghost) + **Publish** (clay). Tab bar remains; Create is selected.

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │
│ Create night                          │
│ ┌ preview card ────────────────────┐  │
│ │ Midnight Garden · Public         │  │
│ └──────────────────────────────────┘  │
│ Title   [Rooftop Jazz Night]          │
│ Date    [Fri 18 Sep]                  │
│ Start   [19:30]  End [22:30]          │
│ Zone    Pacific Time                  │
│ Format  [In person][Online][Hybrid]   │
│ Cover   [illustration]                │
│ Where   The Lantern Roof              │
│ Body    (textarea)                    │
│ HOSTKIT PLAN                          │
│ Type Party · 90 guests · Oakland      │
│ Budget $18,000                        │
│ Theme   Midnight Garden swatches      │
│ Visibility Public / Unlisted / Members│
│ Capacity 90 · Waitlist on · Approve   │
│                                       │
│ [Save draft]            [Publish]     │  sticky
│ Nights   ＋   Door   More              │
└───────────────────────────────────────┘
```

Keyboard: focused fields scroll into view. Publish sits at the end of the form (and Save in the header) so it never fights the Create tab control.

---

## 4. Guests / check-in · `mobile-guests.html`

Door tab. Segment **List | Scan**. Same guest statuses as the desktop spec.

### List

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │
│ Door · Jazz Night                     │
│ [List] [Scan]                         │
│ Search  name, email, domain           │
│ Going 86 · Pending 4 · Wait 7 · …     │  chips wrap
│                                       │
│ Taylor Kim     Checked in      1      │
│ Maya Chen      Going           2      │
│ Jordan Blake   Pending    [✓][✕]      │
│ Priya Shah     Waitlist        1      │
│                                       │
│ Nights   ＋   Door   More              │
└───────────────────────────────────────┘
```

Rows are cards, not a wide table. Approve/decline are 44px.

### Scan

```
┌────────────── 390 × 844 ──────────────┐
│ 9:41                             ●●●  │
│ Door · Jazz Night                     │
│ [List] [Scan]                         │
│ 12 in · 86 going                      │
│ ┌──────────────────────────────────┐  │
│ │         QR viewfinder            │  │
│ └──────────────────────────────────┘  │
│ Last  Taylor Kim  ✓  7:12 PM          │
│ Search fallback [                    ]│
│                                       │
│ Full-screen result:                   │
│   GOING forest · ALREADY IN amber     │
│   NOT ON LIST danger                  │
│ Nights   ＋   Door   More              │
└───────────────────────────────────────┘
```

---

## Motion, type, safe area

- Tab switch: no cross-fade of the whole app; replace the stack.  
- Check-in success: 200ms forest flash.  
- Display: Fraunces 28–34 on Discover/Create titles; 22 on event title in manage.  
- Status bar + home indicator: respect safe area; mocks draw a 9:41 and a home pill.  
- One primary clay action per screen (Publish, Register, or the Create tab).

## Mapping to desktop mocks

| Mobile | Desktop companion |
| --- | --- |
| `mobile-discover.html` | (none; landing is desktop marketing) |
| `mobile-event.html` | `manage-overview.html` + `public-event.html` |
| `mobile-create.html` | `create-event.html` |
| `mobile-guests.html` | `guests.html` |
