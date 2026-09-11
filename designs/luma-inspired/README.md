# HostKit event UX — Luma-inspired design pack

**Product target: a mobile app** (Expo / React Native, or a mobile PWA). Canonical frames are **390 × 844**. Hosts live in a bottom-tab shell (Nights, Create, Door, More). The Next.js demo in this repo is a planning prototype, not the shipping layout. Desktop HTML without the `mobile-` prefix is a tablet / companion reference only.

Design documentation and static HTML prototypes for an **event publishing, registration, and day-of** layer on HostKit. The visual language is HostKit’s existing stationery brand (warm paper, clay accent, Fraunces + Inter). The *product patterns* — create fields, manage tabs, guest statuses, insights — are mapped from **publicly documented** Luma (lu.ma) event-planning UX, then rewritten for HostKit’s host-side planner.

This folder is **not** application runtime. Opening the HTML files does not change `/app`, Prisma, or production UI.

## Attribution

Inspired by public Luma help-center UX patterns and live luma.com *layout* (create flow, manage tabs, guest filters, insights, public-page column split). **HostKit is not affiliated with Luma.** Do not copy Luma logos, wordmarks, trademarks, color-for-color palettes, proprietary illustrations, or pixel-perfect clones. Live screenshots used as reference are **not** stored in this repo.

If a mock feels too close to a third-party product, restyle toward `DESIGN_SYSTEM.md` (paper ground, clay, forest, Fraunces display) rather than toward the reference.

## What’s in this pack

| File | What it is |
| --- | --- |
| [MOBILE.md](./MOBILE.md) | **Canonical** 390×844 specs: tab shell, Discover, Event detail, Create, Guests/check-in |
| [RESEARCH_NOTES.md](./RESEARCH_NOTES.md) | Public help-center IA + live luma.com visual DNA, and how HostKit diverges |
| [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | Screens, nav (mobile-first), planner under More |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | HostKit tokens, type, radius, components, light/dark, original theme catalog |
| [SCREENS.md](./SCREENS.md) | Tablet / companion wireframes (same features, wide layout) |
| [mockups/mobile-discover.html](./mockups/mobile-discover.html) | Phone: Nights / Discover |
| [mockups/mobile-event.html](./mockups/mobile-event.html) | Phone: Event detail (host + guest view) |
| [mockups/mobile-create.html](./mockups/mobile-create.html) | Phone: Create event |
| [mockups/mobile-guests.html](./mockups/mobile-guests.html) | Phone: Door — guests list + QR scan |
| [mockups/manage-overview.html](./mockups/manage-overview.html) | Tablet companion: Manage Overview |
| [mockups/guests.html](./mockups/guests.html) | Tablet companion: Guests table |
| [mockups/create-event.html](./mockups/create-event.html) | Tablet companion: Create Event |
| [mockups/public-event.html](./mockups/public-event.html) | Tablet companion: Public event page |

Sample event throughout: **Rooftop Jazz Night** (Oakland, fictional guests). Every mock is bannered as a **design prototype**.

## How to use these files

1. **Start with `MOBILE.md`**, then `RESEARCH_NOTES.md` and IA. Tablet specs in `SCREENS.md` are secondary.
2. **Open `mockups/mobile-*.html` in a browser** (self-contained: inline CSS, Google Fonts for Inter + Fraunces). Each file draws a 390×844 phone with a bottom tab bar.
3. **Click between mobile mocks** via the tab bar and event cards. Tablet mocks remain linked for wide-layout checks.
4. **Implement against tokens in `DESIGN_SYSTEM.md`**, which already match `app/globals.css` (`paper`, `clay`, `forest`, Fraunces/Inter). Prefer extending those tokens over inventing a parallel palette.
5. **Keep HostKit unique.** Venue scoring, budget write-back, run sheets, and guest-token RSVPs stay first-class. Planner screens live under the **More** tab.

## What this pack is not

- Not a license to ship Luma’s brand or copy.
- Not a rewrite of the working demo’s light-only theme. Dark tokens here are a **proposal** for the publishing layer.
- Not a desktop-first product. Tablet mocks exist for iPad / companion layout only.
- Not production HTML. Markup is prototype-only (inline styles, fake data, no auth).
