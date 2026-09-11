# Research notes (public Luma UX → HostKit)

Reference only. **HostKit is not affiliated with Luma.** Do not copy logos (`luma+` or otherwise), trademarks, event photography, sponsor marks, theme artwork, or pixel-perfect layouts. Translate *jobs-to-be-done* into HostKit’s paper / clay / Fraunces system (`DESIGN_SYSTEM.md`).

Live screenshots used for this note (homepage hero, public event page, Discover list) are **visual reference only**. They must not be committed to this repo, redrawn 1:1, or used as mock artwork.

Sources:

1. **Help-center IA** (public Luma docs, original brief).  
2. **Live luma.com screenshots** attached to the design brief (layout rhythm only).

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

On **phone** (canonical): those become stack segments or More-sheet rows under Nights / Door / More. On **tablet** companions, keep the underline bar. Planner (Plan, Budget, Scout, Shortlist, Run sheet) stays under **More**. Overview still shows coverage (“what this event still needs”).

### Guests

Status filters: Going / Pending / Waitlist / Invited / Not going / Checked in.

Search: name, email, **domain**. Sort. Approve / decline. Bulk CSV update. QR check-in. CSV export.

### Insights

Page views, live traffic, top referrers, cities, sources (UTM), referrals, attendance (registered vs checked in).

### Themes

Light and dark presentations; a **custom accent** that should carry into email CTAs. HostKit default accent is clay; Midnight Garden lifts clay slightly on night grounds.

---

## 2. Live-site visual DNA (from attached screenshots)

Observed as *competitor notes*. HostKit must not ship this look.

### Homepage hero

What the frame actually shows:

- Airy **white** field, generous leftover space.  
- Tiny wordmark centered near the top; **Sign In** as a ghost pill, top-right (not the primary).  
- Oversized **black geometric sans** headline (“Delightful events”) with **pink → orange gradient** on two words (“start here”).  
- Soft gray subcopy under the headline.  
- **Black** rounded primary: “Create Your First Event”; a text link “Discover Events →” under it.  
- **Floating rounded-square tiles** of event art, some overlapping, some slightly rotated, around the type (workshop flyers, food, code, portraits).  
- Feels like a consumer marketplace splash, not stationery.

**HostKit instead:** paper ground, Fraunces headline with a *flat* clay word (never a gradient fill on type), clay pill CTA, 16:9 cards in a stack/grid — **no collage of flying photos**.

### Discover list

What the frame actually shows:

- Compact top nav: wordmark · local time · Discover Events · Sign In.  
- Soft **pastel gradient wash** (lilac) behind the title block.  
- Page title in geometric sans; gray supporting sentence.  
- **Popular Events** + city name; **View All →**.  
- **Two-column dense list**: ~72px rounded-square thumbnail | date/time (gray) / title (black sans) / venue (gray).  
- This particular shot does **not** include the category-icon tiles or Follow-calendar cards mentioned in the written DNA; those remain help-center / other-page notes, not this frame.

**HostKit instead:** Nights tab shows **your** nights as large paper cards, then “Happening nearby” as a compact **thumb + date + place** list (CSS thumbs, HostKit event-type chips — Party / Concert / Dinner — not colorful line-icon taxonomies, no Follow marketplace).

### Public event page

What the frame actually shows:

- **Warm cream** ground (closer to HostKit `paper` than the homepage white).  
- Same compact nav.  
- **Two columns:**  
  - **Left:** large **rounded-square cover**; under it “Hosted By” (avatar + calendar name + social); Contact / Report; **hash tags** as pills.  
  - **Right:** location “Featured in …” chip; **editorial serif** title; date row (calendar glyph + weekday/date + time range); map row (pin + venue + city + outbound); **Registration** card with welcome sentence and a **full-width brown** Register button; **About** body.  
- Geometric sans for nav/UI; serif for the event title only.  
- Soft gray secondary text; lots of whitespace.

**HostKit instead (same skeleton, different skin):**

| Live luma.com | HostKit |
| --- | --- |
| Cream default public page | Themeable. Jazz Night sample = **Midnight Garden** (night) so we do not ship a cream clone. Daytime events may use Paper Quiet. |
| Brown Register | Clay (`#c4502e` / lifted `#e06a45` on night) |
| Left cover + right title/register | **Reuse this column split** on tablet (`public-event.html`) |
| Hash tags | HostKit tags without a forced `#` prefix |
| Sponsor/photography on the cover | CSS illustration only in mocks |

Patterns we **do** reuse: serif title, two-column register, labeled when/where, host block, tags, sticky Register on phone.

Patterns we **do not** reuse: `luma+` mark, black marketing CTA, gradient headline, flying photo tiles, brown-as-brand, third-party cover art.

### Type and color (live, summarized)

- Geometric sans → UI/nav.  
- Editorial serif → event titles.  
- White / cream / warm neutrals, soft gray text, pastel hero washes, bright tile accents, generous whitespace.

---

## 3. Implications for this pack

- **Phone is canonical** (`MOBILE.md`). Discover list rhythm (thumb + date + place) informs “Happening nearby.” Event detail guest view stacks the two-column public page.  
- **Tablet public page** follows left-media / right-story+register. Host tooling stays on paper.  
- HTML mocks use CSS illustrations only. Competitor screenshots stay out of git.  
- Accent from the event theme still carries into email CTAs.
