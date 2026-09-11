# HostKit design system (publishing layer)

Warm, editorial, premium — **good stationery**, not a project-management tool and not a neon event-startup. Tokens below extend `app/globals.css`. Display type is **Fraunces** (optical size + a little `SOFT` / `WONK`); UI type is **Inter**.

Luma’s public product is a useful *pattern* reference. This system uses a different metaphor (paper, clay, forest), different type, and an original theme catalog.

## Brand marks

- Wordmark: `Host` in ink + `Kit` in clay, Fraunces, ~xl. Never “HK” in a circle that mimics another product’s glyph.  
- Favicon / app icon (proposal): a folded place-card silhouette in clay on paper, 1.5px inset.  
- Do not use rainbow orbs, lowercase `lu.ma`-style lockups, or calendar-dot logos associated with other tools.

## Color — light (default, shipped today)

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#fbf8f4` | App ground |
| `surface` | `#ffffff` | Cards, sheets |
| `sunk` | `#f4efe8` | Inset wells, chip idle |
| `ink` | `#1c1917` | Primary text |
| `ink-soft` | `#57504a` | Secondary |
| `ink-mute` | `#8b8179` | Meta, placeholders |
| `line` | `#e9e1d7` | Hairline |
| `line-strong` | `#d8cec1` | Inputs, hover borders |
| `clay` | `#c4502e` | Primary actions, brand, focus |
| `clay-deep` | `#a03f22` | Pressed / hover primary |
| `clay-wash` | `#fbeee8` | Selected chips, tint |
| `forest` | `#2a4a40` | Confirmed, booked, going |
| `forest-wash` | `#e8f0ec` | Success wells |
| `amber` | `#9a6b10` | Pending, waitlist, due soon |
| `amber-wash` | `#fbf1dc` | Warning wells |
| `danger` | `#8e2a20` | Destructive, not going |
| `danger-wash` | `#fbeae8` | Error wells |

Selection: clay fill, white text. Focus ring: `2px solid clay`, offset 2px.

## Color — dark (proposal for public pages + check-in)

The current app is light-only on purpose (paper has no honest inverse). For **guest-facing night events** and door-staff check-in, a warm dark is allowed:

| Token | Hex | Use |
| --- | --- | --- |
| `night` | `#161310` | Ground |
| `night-surface` | `#221e1a` | Cards |
| `night-sunk` | `#2c2722` | Wells |
| `night-ink` | `#f4efe8` | Text |
| `night-mute` | `#a89f95` | Meta |
| `night-line` | `#3a342d` | Borders |
| `clay` | `#e06a45` | Slightly lifted for contrast |
| `forest` | `#8fbfad` | Going / success on dark |

Accent chosen in the theme picker **carries into emails** (CTA button background) and the public page register card. Default accent remains clay.

## Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display | **Fraunces** | Headings, wordmark, empty-state titles. `font-variation-settings: "SOFT" 30, "WONK" 1`; tracking `-0.02em` |
| Sans | **Inter** | UI, tables, forms. `-webkit-font-smoothing: antialiased` |
| Numeric | Inter, `tabular-nums` | Counts, money, times |

Scale (desktop):

| Name | Size / line | Weight |
| --- | --- | --- |
| Display xl | 48–56 / 1.08 | 500 Fraunces |
| Display l | 32–36 / 1.15 | 500 Fraunces |
| Display m | 22–24 / 1.2 | 500 Fraunces |
| Title | 18 / 1.3 | 500 Fraunces |
| Body | 16 / 1.55 | 400 Inter |
| UI | 14 / 1.4 | 500 Inter |
| Meta | 13 / 1.4 | 400 Inter |
| Overline | 12 / 1.3 | 500 Inter, uppercase, tracking `0.06em`, clay |

Do not substitute Inter for headings. Do not use geometric display fonts (the usual “event startup” look).

## Radius

| Token | Value | Use |
| --- | --- | --- |
| `radius-pill` | `999px` | Buttons, chips, avatars |
| `radius-card` | `0.875rem` (14px) | Cards, sheets, cover frames |
| `radius-lg` | `0.5rem` (8px) | Inputs, inner wells |
| `radius-sm` | `4px` | Focus fallback, tiny badges |

Covers: `radius-card`, never a full-bleed circle.

## Spacing

4px base. Common steps: 8, 12, 16, 20, 24, 32, 40, 48, 64.

Page: `max-w-6xl` (1152px) + `px-5` (20px). Public event: narrower reading column `max-w-3xl` plus a register rail.

Manage content stacked `space-y-8` (32px). Form fieldsets `space-y-10`.

## Elevation

No drop-shadow soup. Cards: `border: 1px solid line` on `surface`. Sticky header: `paper/85` + backdrop blur. Public cover may use a 16px inner vignette, not a material shadow.

## Components

### Buttons

Pill-shaped. Variants: **primary** (clay, white), **secondary** (surface, strong line), **ghost**, **danger** (danger-wash → danger fill on hover). Sizes: sm 32, md 40, lg 48.

### Chips / filters

Idle: sunk, ink-soft. Selected: clay-wash, clay-deep, no heavy border. Count in tabular nums.

### Badges

`rounded-full px-2.5 py-1 text-xs font-medium` + tone washes (neutral, clay, forest, amber, danger).

### Cards

`rounded-card border-line bg-surface`. Dividers `divide-line`. Empty: dashed `line-strong`, Fraunces title.

### Inputs

`rounded-lg border-line-strong`, 10px vertical padding. Focus: clay border, **no** glow. Labels 14px medium ink; hints ink-mute.

### Tabs

Underline, 2px. Active: clay border + ink label. Inactive: transparent + ink-soft. Horizontal scroll on small screens. Do not use pill tabs for the manage bar (those are for filters).

### Tables

Header meta uppercase 12px. Rows 56–64px, hover sunk. Sticky first column on mobile. Status badge in column 2.

### Cover / media

3:2 or 16:9 inside `radius-card`. Placeholder: clay→forest diagonal wash + Fraunces initial of the event title. Hosts upload; mocks use CSS illustration only (no stock photography of real venues).

### Theme swatch

32×32 rounded-lg. Selected: 2px clay ring, 2px offset. Name under swatch, 11px.

## Motion

120–180ms color/border. No bounce. Page transitions: none in mocks. Check-in success: forest wash flash 200ms.

## Guest status color

| Status | Tone |
| --- | --- |
| Going | forest |
| Pending | amber |
| Waitlist | clay |
| Invited | neutral |
| Not going | danger |
| Checked in | forest + small “door” meta |

## Theme catalog (original HostKit names)

Forty-two themes in five families. Families echo *categories* commonly documented on event platforms (quiet, celebration, marks, weave, season) without copying another product’s theme names or artwork.

Each theme defines: `ground`, `surface`, `ink`, `accent` (email + CTA), `cover-treatment` (none, grain, wash, rule).

### Quiet (minimal)

1. Paper Quiet  
2. Gallery White  
3. Ink Line  
4. Stone Terrace  
5. Linen  
6. Ivory Ledger  
7. Quiet Oak  
8. Pale Clay  

### Celebration

9. Champagne Burst  
10. Ribbon Night  
11. Sparkler  
12. Toast Gold  
13. Streamer Garden  
14. Firefly  
15. Fanfare  
16. Brass Hall  

### Marks (pictorial, not emoji packs from other brands)

17. Wax Seal  
18. Place Card  
19. Menu Script  
20. Napkin Fold  
21. Candle Drip  
22. Stemware  
23. Envelope  
24. Host Marks  

### Weave (pattern)

25. Herringbone  
26. Damask Dusk  
27. Stripe Tent  
28. Lattice  
29. Marquee Dot  
30. Gingham Picnic  
31. Terrazzo  
32. Quilt  

### Season

33. Late Spring  
34. High Summer  
35. Harvest Table  
36. First Frost  
37. New Year Ember  
38. Golden Hour  
39. Rain on Glass  
40. Solstice  
41. Equinox  
42. Midnight Garden  

**Rooftop Jazz Night** sample uses **Midnight Garden** on the public page (night ground, clay accent) and **Paper Quiet** in manage (host tooling stays on paper so budgets stay readable).

Hosts may override **accent only**; emails always pick up that accent.

## Mobile app shell

HostKit is a **phone app** first. Tokens above still apply; these rules are extra.

| Token | Value | Use |
| --- | --- | --- |
| Frame | `390 × 844` | Spec and HTML phone mocks |
| Status | 44px | Simulated 9:41 |
| Header | 52px | Wordmark / back / avatar |
| Tab bar | 64px + 20px safe | Four tabs; Create is a 40px clay circle *in* the bar (no overlap) |
| Touch | ≥ 44px | Chips, rows, icon buttons |
| Sheet | 12px top radius | More, register, check-in result |

No hover-only actions. One clay primary per screen. Guest deep links hide the tab bar and use a sticky Register footer (48px + safe).

Target clients: **Expo / React Native** (native tabs, camera for QR) or a **mobile PWA** (same layout, `getUserMedia` / file QR later). The current Next.js App Router demo is not the shipping chrome.

## Contrast with observed luma.com marketing (do not ship)

Live luma.com (see `RESEARCH_NOTES.md`) uses a white hero, oversized geometric-sans headlines with **pink/orange gradient** stress, floating photo tiles, and a **black** rounded CTA. HostKit does none of that.

Reuse only the *public event* skeleton that already fits stationery: cream/paper ground option, serif title, two-column register rail, labeled when/where, host block, tags. Default HostKit public sample in this pack is **Midnight Garden** (night club, clay CTA) so a Jazz Night does not look like a cream marketing clone.

## Do / don’t

**Do:** Fraunces for titles; clay for one action per view; forest for “this is booked / going”; dashed empty states; tabular numbers.

**Don’t:** Gradient headlines; black primary buttons; Inter-only pages; floating photo collages; copy another product’s theme thumbnails or logos; more than one primary button in a card; drop shadows on every tile.
