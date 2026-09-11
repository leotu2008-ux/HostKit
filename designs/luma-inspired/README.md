# HostKit event UX — Luma-inspired design pack

Design documentation and static HTML prototypes for an **event publishing, registration, and day-of** layer on HostKit. The visual language is HostKit’s existing stationery brand (warm paper, clay accent, Fraunces + Inter). The *product patterns* — create fields, manage tabs, guest statuses, insights — are mapped from **publicly documented** Luma (lu.ma) event-planning UX, then rewritten for HostKit’s host-side planner.

This folder is **not** application runtime. Opening the HTML files does not change `/app`, Prisma, or production UI.

## Attribution

Inspired by public Luma help-center UX patterns (create flow, manage dashboard tabs, guest filters, insights metrics, theme families). **HostKit is not affiliated with Luma.** Do not copy Luma logos, wordmarks, trademarks, color-for-color palettes, proprietary illustrations, or pixel-perfect clones of Luma screens.

If a mock feels too close to a third-party product, restyle toward `DESIGN_SYSTEM.md` (paper ground, clay, forest, Fraunces display) rather than toward the reference.

## What’s in this pack

| File | What it is |
| --- | --- |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | Screens, nav, and how HostKit’s planner maps onto a Luma-style manage surface |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | HostKit tokens, type, radius, components, light/dark, original theme catalog |
| [SCREENS.md](./SCREENS.md) | Wireframe-level specs for Discover, Create, public page, Manage, Guests, Registration, Blasts, Insights, Check-in |
| [mockups/manage-overview.html](./mockups/manage-overview.html) | High-fidelity static mock of Manage → Overview |
| [mockups/guests.html](./mockups/guests.html) | Guests table with status filters and bulk actions |
| [mockups/create-event.html](./mockups/create-event.html) | Create Event composer |
| [mockups/public-event.html](./mockups/public-event.html) | Guest-facing public event page |

Sample event throughout: **Rooftop Jazz Night** (Oakland, fictional guests). Every mock is bannered as a **design prototype**.

## How to use these files

1. **Read IA first**, then the design system, then screen specs. Mocks are illustrations of those specs, not a second source of truth.
2. **Open mocks in a browser** (double-click or `open designs/luma-inspired/mockups/…`). They are self-contained: inline CSS, Google Fonts for Inter + Fraunces, no build step.
3. **Click between mocks** using the prototype chrome (tabs, “Preview page”, “Create event”). Links stay inside this folder.
4. **Implement against tokens in `DESIGN_SYSTEM.md`**, which already match `app/globals.css` (`paper`, `clay`, `forest`, Fraunces/Inter). Prefer extending those tokens over inventing a parallel palette.
5. **Keep HostKit unique.** Venue scoring, budget write-back, run sheets, and guest-token RSVPs stay first-class. Luma-style publishing sits *beside* that planner, mostly under Manage → More.

## What this pack is not

- Not a license to ship Luma’s brand or copy.
- Not a rewrite of the working demo’s light-only theme. Dark tokens here are a **proposal** for the publishing layer.
- Not production HTML. Markup is prototype-only (inline styles, fake data, no auth).
