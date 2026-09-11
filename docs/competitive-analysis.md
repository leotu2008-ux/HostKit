# HostKit — competitive analysis

Date: 2026-09-11. Scope: HostKit (web + native iOS, campus-first event hosting
and discovery) against Luma, Partiful and Eventbrite, with the campus
incumbents (CampusGroups, Corq/Engage) and the no-app alternatives as
indirect competition. Sources at the end.

## Where HostKit stands today

What's built (branch `worktree-ios-app-luma-ui`): create an event before
signing in; `.edu` accounts with school-tagged events that surface first on
Discover; city auto-detection; "Your events" first; Apple Maps venue search;
a Manage dashboard (Overview · Outreach with drafted messages · Blasts via
Resend · Promote with QR/blurb/on-device AI copy) plus the planner (budget,
timeline, scout, shortlist, run sheet); QR-free check-in; photo covers and
avatars; SMS-verified phone numbers; dark mode; Inter throughout.

What's **not** built, and matters for this comparison: paid tickets are a
field, not a payment flow (no Stripe / Apple Pay); no push notifications; no
add-to-calendar; no guest ↔ host chat; no recurring events; no Android.

## The analysis

```json
{
  "competitors": [
    {
      "name": "Luma",
      "category": "market_leader",
      "app_store_rating": "4.9/5 (≈18K ratings); iOS app last updated Aug 2024 — Luma is web-first",
      "downloads": "millions of attendees; the default for tech, crypto, AI and wellness community events",
      "pricing": {
        "model": "freemium + platform fee",
        "price": "Free (5% fee on paid tickets, 500 invites/week); Luma Plus $59/mo annual or $69/mo (no platform fee, 5,000 sends/week, custom URL, API/Zapier); extra send packs $50–$800",
        "tiers": ["free", "plus", "enterprise"]
      },
      "key_features": [
        "Calendar-first: a host has a calendar people subscribe to, events hang off it",
        "Beautiful event pages, ticketing, approval / token-gated registration",
        "Email blasts, QR check-in, CSV import/export, Zoom attendance",
        "Discover feed of curated local events (strongest in tech scenes)",
        "In-app attendee chat, unlimited cohosts"
      ],
      "unique_features": [
        "Subscribable host calendars (the social graph is the calendar)",
        "Token gating / API access on Plus"
      ],
      "strengths": [
        "Best-in-class event page design and host UX; the look HostKit was inspired by",
        "Real discovery with density in tech hubs; recurring series work well",
        "Free tier is generous for occasional hosts"
      ],
      "weaknesses": [
        "No student or campus layer — discovery is by city and interest, not school",
        "Nothing after the invite: no venue search, vendor outreach, budget or run sheet",
        "Plus at $59/mo is priced for companies and communities, not a student org",
        "iOS app is a thin companion (stale since 2024); hosting happens on the web",
        "Send caps on free push active hosts toward Plus"
      ],
      "target_audience": "Tech/startup communities, meetups, professional hosts, virtual + IRL",
      "positioning": "\"Delightful events\" — the calendar as a social network"
    },
    {
      "name": "Partiful",
      "category": "challenger (the Gen Z default for private parties)",
      "app_store_rating": "4.96/5 (≈172K ratings)",
      "downloads": "tens of millions; Apple's 2024 App of the Year (Cultural Impact)",
      "pricing": {
        "model": "free; monetises around the party",
        "price": "$0 for every feature; revenue from Group Order (Instacart carts, $5 delivery + % of order) and, since June 2026, ticketing with size/price-scaled fees (free tickets stay free)",
        "tiers": ["free"]
      },
      "key_features": [
        "Playful invite pages with GIFs, themes, music; RSVP by phone number",
        "Text blasts, guest list with ±1s, \"boops\" (reactions on RSVPs)",
        "Chip In / Group Order for costs and supplies",
        "Ticketing (new, June 2026)"
      ],
      "unique_features": [
        "Boops and the social feed on the RSVP list",
        "Group Order commerce inside the invite"
      ],
      "strengths": [
        "Network effects among 18–30s — friends already have it, RSVP takes one tap",
        "Zero cost, zero setup; the fun is the product",
        "Now covers small paid events too"
      ],
      "weaknesses": [
        "No public discovery — Partiful is invite-only; you can't find a party you weren't sent",
        "Guests must hand over a phone number to RSVP (a recurring privacy complaint)",
        "Stability complaints: crashes on date edits and GIF-heavy pages; account creation bugs",
        "No hosting logistics at all (venue, vendors, budget), no cohost roles beyond basic",
        "Ticket fees are opaque — shown at setup, not published"
      ],
      "target_audience": "Gen Z / young millennials throwing birthdays, house parties, dinners",
      "positioning": "\"Party invites your friends will actually open\""
    },
    {
      "name": "Eventbrite",
      "category": "market_leader (public ticketed events)",
      "app_store_rating": "4.9/5 (≈1.8M ratings), updated weekly",
      "downloads": "hundreds of millions; the incumbent marketplace",
      "pricing": {
        "model": "per-ticket fees + optional subscription",
        "price": "Free events: $0. Paid: 3.7% + $1.79 service fee + 2.9% processing per ticket (≈13.8% of a $25 ticket, ≈10% of $50); Pro from $15/mo adds branding, analytics, email marketing but does not remove fees",
        "tiers": ["free", "pro", "premium"]
      },
      "key_features": [
        "Ticket sales, tiers, promo codes, payouts, refunds, tax handling",
        "Discovery marketplace with strong SEO and category browsing",
        "Organizer app with scanning check-in, email campaigns (Pro)",
        "Attendee app with tickets in Wallet"
      ],
      "unique_features": [
        "Marketplace scale and search traffic",
        "Full payments/compliance stack (taxes, refunds, payouts)"
      ],
      "strengths": [
        "Trust and reach for public paid events; buyers already have accounts",
        "Mature payments and organizer analytics"
      ],
      "weaknesses": [
        "Fees are the #1 review complaint (\"they charge you to transfer your own money\")",
        "Corporate, form-heavy hosting flow; event pages look like listings, not invitations",
        "No private/social layer — wrong tool for a student social or a dinner",
        "No planning help: you arrive with a venue and a plan already"
      ],
      "target_audience": "Professional organizers, venues, classes, festivals, nonprofits",
      "positioning": "The marketplace to sell tickets and be found"
    },
    {
      "name": "CampusGroups / Corq (Engage) — indirect",
      "category": "niche (institution-bought)",
      "app_store_rating": "Corq ~3–4/5; users report UI lag",
      "downloads": "Deployed per university; every student has it, few open it",
      "pricing": {
        "model": "B2B license sold to the university",
        "price": "Not student-facing; $0 to students",
        "tiers": ["institution"]
      },
      "key_features": [
        "Official org directory, event calendar, forms, room booking, attendance tracking for the school"
      ],
      "unique_features": ["Ties into student-life offices and official org recognition"],
      "strengths": ["Every recognised club is on it; advisers require it for funding"],
      "weaknesses": [
        "Official events only — nobody hosts a rooftop social on Corq",
        "Dated UX, no invitation feel, no cross-school or city discovery",
        "Students go there to satisfy a requirement, not to find a night out"
      ],
      "target_audience": "Student-life administrators; students by mandate",
      "positioning": "Campus engagement platform (sold to the school)"
    },
    {
      "name": "No-app alternatives — indirect",
      "category": "alternative",
      "app_store_rating": "n/a",
      "downloads": "everyone",
      "pricing": { "model": "free", "price": "$0", "tiers": [] },
      "key_features": ["Instagram stories + close friends, GroupMe / iMessage groups, a Google Form, a flyer with a QR code"],
      "unique_features": ["Already where the audience is"],
      "strengths": ["Zero friction to post; the group chat is the campus's real event feed"],
      "weaknesses": ["No headcount, no capacity, no check-in, no reminder, events vanish in 24h; hosts rebuild the list every time"],
      "target_audience": "Every student host today",
      "positioning": "The default HostKit actually has to beat"
    }
  ],
  "feature_matrix": {
    "Free event pages, unlimited guests":        {"HostKit": true,  "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Native iOS app for hosting":               {"HostKit": true,  "Luma": "companion only", "Partiful": true, "Eventbrite": "organizer app"},
    "Android":                                   {"HostKit": false, "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Create before signing in":                  {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": false},
    "Public discovery feed":                     {"HostKit": true,  "Luma": true,  "Partiful": false, "Eventbrite": true},
    "Campus / .edu-tagged discovery":            {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": false},
    "City auto-detected from location":          {"HostKit": true,  "Luma": true,  "Partiful": false, "Eventbrite": true},
    "Paid tickets with payments":                {"HostKit": false, "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Email blasts to guests":                    {"HostKit": true,  "Luma": true,  "Partiful": false, "Eventbrite": "Pro"},
    "SMS blasts":                                {"HostKit": false, "Luma": false, "Partiful": true,  "Eventbrite": false},
    "Check-in at the door":                      {"HostKit": true,  "Luma": "QR", "Partiful": false, "Eventbrite": "QR scan"},
    "QR code for the event":                     {"HostKit": true,  "Luma": true,  "Partiful": false, "Eventbrite": true},
    "Venue search inside Create":                {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": false},
    "Vendor / speaker outreach with drafted messages": {"HostKit": true, "Luma": false, "Partiful": false, "Eventbrite": false},
    "Budget, timeline, run sheet":               {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": false},
    "On-device AI copy (private)":               {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": "cloud AI"},
    "Cohosts / collaborator roles":              {"HostKit": "basic", "Luma": true, "Partiful": "basic", "Eventbrite": true},
    "Guest chat / social RSVP list":             {"HostKit": false, "Luma": true,  "Partiful": true,  "Eventbrite": false},
    "Push notifications / reminders":            {"HostKit": false, "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Add to calendar":                           {"HostKit": false, "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Recurring events / series":                 {"HostKit": false, "Luma": true,  "Partiful": false, "Eventbrite": true},
    "Approval-required registration":            {"HostKit": false, "Luma": true,  "Partiful": "approve guests", "Eventbrite": false},
    "Photo covers":                              {"HostKit": true,  "Luma": true,  "Partiful": true,  "Eventbrite": true},
    "Verified phone on account; hosts can reach registrants": {"HostKit": true, "Luma": false, "Partiful": "phone required to RSVP", "Eventbrite": false},
    "Siri / Shortcuts":                          {"HostKit": true,  "Luma": false, "Partiful": false, "Eventbrite": false}
  },
  "feature_gaps": [
    "Nobody serves the student host: campus-scoped discovery + a hosting toolkit in one app. Luma/Partiful stop at the invite; Corq stops at the official calendar.",
    "Nobody helps you *produce* the event — venue, vendors, speakers, budget, run sheet — even Eventbrite assumes you arrive with all of it.",
    "Discovery that is semi-public: visible to your school first, open to the city, without being a marketplace listing. Partiful has no discovery; Luma's is city/interest; Eventbrite's is a search engine.",
    "Phone as a host tool rather than a guest toll: Partiful makes guests hand over a number just to RSVP; nobody gives hosts a verified way to reach registrants.",
    "A native, host-first iOS app: Luma's is a stale companion, Eventbrite's organizer app is a scanner with a dashboard."
  ],
  "pricing_insights": {
    "average_price": "$0 for free events across the board; paid tickets cost hosts 5% (Luma), ~10–14% (Eventbrite), undisclosed but scaled (Partiful)",
    "pricing_range": "$0 – $69/mo subscriptions; $0 – 13.8% per ticket",
    "common_model": "Free for free events, take-rate on paid tickets, subscription to remove caps/fees or add branding",
    "pricing_gaps": [
      "No mid-tier for a student org or a small community: Luma jumps from $0 to $59/mo; Eventbrite Pro ($15) still keeps every fee",
      "Free-tier send caps (Luma 500/week) bite exactly when a campus event goes viral",
      "Nobody publishes a simple flat ticket fee a student host can reason about"
    ]
  },
  "differentiation_opportunities": [
    {
      "opportunity": "Own the campus: .edu-trusted, school-tagged events that surface to classmates first but stay open to the city",
      "reasoning": "Luma, Partiful and Eventbrite have no concept of a school; the campus incumbents only carry official events and nobody enjoys them. HostKit already ships this — make it the headline, and go school by school (Babson → Boston).",
      "potential_impact": "high"
    },
    {
      "opportunity": "Be the only invite tool that also produces the event (venue → outreach → budget → run sheet → door)",
      "reasoning": "Every competitor ends at the RSVP. HostKit's planner and Manage dashboard are the moat once a host has run one event through it; the drafted outreach messages are a concrete 'wow' no one else has.",
      "potential_impact": "high"
    },
    {
      "opportunity": "No friction to start, no fees to grow: create before login, unlimited free events, no send caps at student scale",
      "reasoning": "Directly attacks Luma's caps/Plus jump and Eventbrite's fee resentment; matches Partiful's $0 while offering discovery Partiful can't.",
      "potential_impact": "medium"
    },
    {
      "opportunity": "Native and private on iPhone: Apple Intelligence copy on-device, Siri check-in, Photos, MapKit venues, no ads, no data resale",
      "reasoning": "Partiful's privacy complaints (phone required, calendar permission) and Luma's stale app leave room for a 'made for iPhone' story; it's also the App Store featuring angle.",
      "potential_impact": "medium"
    },
    {
      "opportunity": "Hosts can reach registrants (verified phone + email) instead of guests paying a phone toll to RSVP",
      "reasoning": "Flip Partiful's model: the guest chooses to share a verified number; the host gets a real contact list. Add SMS blasts on top of email and HostKit matches Partiful's best host feature with consent built in.",
      "potential_impact": "medium"
    }
  ],
  "market_positioning_map": {
    "axes": ["Cost to the host (low → high)", "Hosting depth (invite only → full production)"],
    "competitors": [
      {"name": "Partiful",   "position": [1, 2]},
      {"name": "Luma",       "position": [5, 5]},
      {"name": "Eventbrite", "position": [8, 6]},
      {"name": "Corq/CampusGroups (to students)", "position": [1, 3]},
      {"name": "HostKit",    "position": [1, 8]}
    ],
    "opportunity_quadrant": "Low cost, high hosting depth — nobody is there; HostKit is, minus payments"
  },
  "recommendation": "Position HostKit as 'the app student hosts run their events on' — campus-first discovery plus the toolkit to actually put the night on — not as a prettier Luma or a Partiful with a feed. Win one campus at a time (Babson first), where Partiful owns private parties and Corq owns official ones, and take the middle: the open student social, the pitch night, the club mixer. Before public launch close the three table-stakes gaps the matrix shows — paid tickets with Apple Pay/Stripe, push reminders, add-to-calendar — because every competitor has all three. Keep free events free with no caps; when payments land, charge a flat, published ~3% + $0.50 per paid ticket (below Luma's 5%, far below Eventbrite) and offer a 'Host Pro' at ~$9/mo for orgs (custom link, analytics, unlimited blasts) — the mid-tier the market lacks."
}
```

## Reading the matrix

**Where HostKit already leads.** Campus-tagged discovery, create-before-login,
venue search, drafted outreach, budget/run sheet, on-device AI copy, Siri —
none of the three big players has any of these, and the campus incumbents
only carry official events. The Manage dashboard is a category no one else
occupies: every competitor's product ends at the RSVP list.

**Where HostKit is behind (table stakes).** Paid tickets with actual
payments, push reminders, add-to-calendar, Android, guest chat. The first
three are on every competitor and are the ones a host will notice on day one;
they should land before an App Store launch. Android and chat can wait —
HostKit's story is "made for iPhone", and the web app covers Android hosts.

**Who HostKit really competes with, by event type.**

| Event | Today's default | HostKit's angle |
| --- | --- | --- |
| House party / birthday | Partiful | Not the target — Partiful's network effect is decisive here |
| Club mixer, pitch night, open student social | GroupMe + Instagram story, Corq if required | The wedge: discoverable to classmates, plannable, checkable at the door |
| Professional meetup in the city | Luma | Second wave: same toolkit, city feed, no $59/mo jump |
| Paid public event | Eventbrite | Only once payments exist; then compete on fees and design |

## Pricing recommendation

- **Free events: free, forever, no caps.** Match Partiful, beat Luma's send
  limits. Students never hit a paywall for the core loop.
- **Paid tickets (once built): a flat, published fee — about 3% + $0.50 per
  ticket**, host may absorb or pass on. Clearly below Luma (5%) and Eventbrite
  (~10–14% effective), and simpler than Partiful's undisclosed scale.
- **Host Pro, ~$9/month** for orgs and repeat hosts: custom event link, guest
  analytics, unlimited blasts, SMS blasts, multiple admins. This is the
  mid-tier that doesn't exist between Luma's $0 and $59.
- **Campus license, later**: sell to student-life offices only after
  students already use it — the opposite of Corq's route.

## Gaps to close before launch (from this analysis)

1. Payments for paid tickets (Stripe or Apple Pay) — every competitor has it;
   the `ticketType`/`ticketPriceCents` fields are already there.
2. Push notifications: registration confirmed, day-before reminder, host
   blast delivered.
3. Add to calendar (EventKit on iOS, `.ics` on web).
4. SMS blasts on top of email — the Twilio sender exists; segments exist.
5. Approval-required registration (a Luma staple hosts of limited-capacity
   events expect).

## Sources

- Luma pricing and features: [ColdIQ review](https://coldiq.com/tools/luma), [SaaSworthy pricing](https://www.saasworthy.com/product/lu-ma/pricing), [party.pro Luma guide](https://party.pro/luma/), [Efficient App review](https://efficient.app/apps/luma), [Luma on the App Store](https://apps.apple.com/us/app/luma-events-invites/id1546150895)
- Partiful: [Sacra](https://sacra.com/c/partiful/), [party.pro Partiful review](https://party.pro/partiful/), [SimpleTix on Partiful ticketing](https://www.simpletix.com/partiful-launches-ticketing/), [Mixily: Evite vs Partiful](https://blog.mixily.com/evite-vs-partiful/), [Bitrise App Store benchmark](https://bitrise.io/resources/tools/app-navigator/apps/ios/com.partiful.partiful), [JustUseApp reviews](https://justuseapp.com/en/app/1662982304/partiful/reviews)
- Eventbrite fees: [Checkout Page](https://checkoutpage.com/blog/eventbrite-fees), [SimpleTix 2026 changes](https://www.simpletix.com/eventbrite-2026-pricing-changes/), [EventCloud fee breakdown](https://www.eventcloud.io/blog/how-much-does-eventbrite-charge-2026), [Eventbrite on the App Store](https://apps.apple.com/us/app/eventbrite/id487922291)
- Campus platforms: [CampusGroups](https://www.readyeducation.com/campusgroups/streamline-university-event-management-campusgroups/), [Corq on Google Play](https://play.google.com/store/apps/details?id=com.campuslabs.collegiatelink&hl=en_US), [CircleU guide](https://circleu.app/blog/digital-campus-guide), [Santa Barbara News-Press on neoQuad](https://www.newspress.com/2026/08/31/santa-barbara-city-college-app-aims-to-unite-students-through-campus-events/)
