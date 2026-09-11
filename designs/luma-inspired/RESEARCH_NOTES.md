# Research notes (public Luma UX → HostKit)

Reference only. **HostKit is not affiliated with Luma.** Do not copy logos, trademarks, proprietary illustrations, theme artwork, or pixel-perfect layouts. Translate *jobs-to-be-done* into HostKit’s paper / clay / Fraunces system (`DESIGN_SYSTEM.md`).

Sources used in this pack:

1. **Help-center IA** (public Luma docs, summarized in the original brief).  
2. **Live-site visual DNA** from luma.com (homepage, Discover, public event page) — structural notes, not a style to reproduce.

---

## 1. Help-center information architecture

### Create flow

Hosts set, in roughly this order:

| Field | HostKit translation |
| --- | --- |
| Title | Event title (Fraunces on the public page) |
| Date / time / timezone | Same; HostKit also seeds the planning timeline from the date |
| Type: in-person / online / hybrid | Format chips |
| Cover image | HostKit CSS/illustration placeholders; hosts upload later |
| Location or meeting link | Required by format |
| Rich description | Public body |
| Theme picker (40+; families often documented as Minimal / festive / pictorial / pattern / seasonal) | **Original HostKit catalog** of 42 names in Quiet / Celebration / Marks / Weave / Season — see `DESIGN_SYSTEM.md` |
| Calendar selection | Host calendars (“The Lantern Sessions”) |
| Visibility: public / private / member-only | Public / Unlisted / Calendar members |
| Registration: approval, capacity, waitlist | Same policies + HostKit headcount rule |

### Manage dashboard tabs

Documented as: **Overview | Guests | Registration | Blasts | Insights | More**

HostKit keeps that primary bar and puts the existing planner (Plan, Budget, Scout, Shortlist, Run sheet) under **More**, with Overview still showing coverage (“what this event still needs”).

### Guests

Status filters: Going / Pending / Waitlist / Invited / Not going / Checked in.

Search: name, email, **domain**. Sort. Approve / decline. Bulk CSV update. QR check-in. CSV export.

### Insights

Page views, live traffic, top referrers, cities, sources (UTM), referrals, attendance (registered vs checked in).

### Themes

Light and dark presentations; a **custom accent** that should carry into email CTAs. HostKit default accent is clay; Midnight Garden lifts clay slightly on night grounds.

---

## 2. Live-site visual DNA (luma.com)

Observed as *competitor notes*. HostKit must not ship this look.

### Homepage

- Airy white hero, lots of leftover space.  
- Oversized **black sans** headline with **pink/orange gradient** emphasis on a word or two.  
- Floating event-image tiles (photos overlapping the hero).  
- Rounded **black** primary CTA. Minimal Sign In.  
- Feels like a consumer marketplace landing, not stationery.

### Discover

- Compact top nav.  
- **Popular events** as a dense list: thumbnail + date + location.  
- **Category tiles** with colorful line icons and counts.  
- Featured-calendar cards with a Follow action.

### Public event page

- **Warm cream** background (closer to HostKit paper than the homepage white).  
- Two-column layout: story on the left, **sticky / full-width Register** on the right (brown CTA on the observed page).  
- Large cover, **editorial serif** event title.  
- Date/time and map as labeled rows.  
- Host profile block, tags, long description.

### Type and color (live)

- Geometric sans for UI and nav.  
- Editorial serif for event titles.  
- White / warm neutrals, soft gray text, pastel gradients, bright category accents, generous whitespace.

### What HostKit does instead

| Observed on Luma live | HostKit |
| --- | --- |
| Pink/orange gradient in headlines | No gradient type. Clay as a flat accent |
| Black pill CTA | Clay pill CTA (`#c4502e`) |
| Geometric sans wordmark / UI | **Fraunces** wordmark + headings, Inter UI |
| Floating photo tiles on the home hero | Event cards on a paper ground, 16:9 covers in `radius-card`, no overlap collage |
| Colorful category line-icons | HostKit event-type chips (Wedding, Dinner, Party…) |
| Cream public page as the default | Paper for host tooling; **themeable** public pages (sample Jazz Night = Midnight Garden, which is *darker* and more club-like so it does not read as a cream clone) |
| Brown register button | Clay (or the event accent) |

The serif title + two-column register rail + labeled when/where rows are **UX patterns** we *do* reuse. The gradient marketing hero and black CTAs are **brand**; we do not.

---

## 3. Implications for this pack

- Manage chrome stays on **paper** so budgets and tables stay readable (HostKit’s existing product).  
- Public page follows the live two-column + sticky register *structure*, with HostKit tokens and a host profile + tags.  
- Discover/home in `SCREENS.md` uses “Your nights” cards + “Happening nearby” — HostKit’s host-side product, not a clone of Luma Discover category iconography.  
- HTML mocks use CSS illustrations only (no scraped photos, no third-party logos).

Screenshots from a live scrape, if attached to a brief, are **visual reference for layout rhythm only**. They must not be redrawn 1:1 into HostKit.
