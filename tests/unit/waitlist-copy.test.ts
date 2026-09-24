import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFind: vi.fn(),
  registrationState: vi.fn(),
  seatFree: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "hosty.test" }) }));
vi.mock("@/lib/db", () => ({ db: { event: { findUnique: mocks.eventFind } } }));
vi.mock("@/lib/session", () => ({
  getCurrentUser: async () => ({ id: "u-1", name: "Grace", email: "grace@example.com" }),
  canAccessEvent: async () => false,
}));
vi.mock("@/lib/registration", () => ({ registrationState: mocks.registrationState }));
vi.mock("@/lib/waitlist", () => ({
  attendingHeads: async () => 10,
  seatFree: mocks.seatFree,
  waitlistPositionFor: async () => 2,
}));
vi.mock("@/lib/attendees", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/attendees")>()),
  attendeesPreview: async () => ({ attendees: [], total: 0 }),
}));
vi.mock("@/lib/actions/register", () => ({ registerForEventAction: vi.fn() }));
vi.mock("@/lib/actions/guests", () => ({ submitRsvpAction: vi.fn() }));

import EventPage from "@/app/e/[id]/page";
import { RsvpForm } from "@/components/rsvp-form";

// A 7pm Eastern night, stored as the host's wall clock encoded as UTC.
const SEVEN_PM = new Date("2026-09-11T19:00:00Z");
const BEFORE = new Date("2026-09-11T20:00:00Z"); // 4pm in Boston
const DURING = new Date("2026-09-12T00:00:00Z"); // 8pm in Boston

const EVENT = {
  id: "ev-1",
  title: "Pitch Night",
  type: "MIXER",
  kind: null,
  status: "PUBLISHED",
  published: true,
  visibility: "PUBLIC",
  ownerId: "u-host",
  guestCount: 10,
  requiresApproval: false,
  ticketType: "FREE",
  ticketPriceCents: 0,
  date: SEVEN_PM,
  endDate: null,
  durationHours: 3,
  schoolDomain: null,
  city: "Boston",
  address: null,
  lat: null,
  lng: null,
  coverUrl: null,
  description: null,
  vibe: null,
  owner: { id: "u-host", name: "Leo" },
  club: null,
  _count: { guests: 10 },
};

async function renderPage(now: Date) {
  vi.useFakeTimers({ toFake: ["Date"], now });
  const page = await EventPage({ params: Promise.resolve({ id: "ev-1" }) });
  return renderToStaticMarkup(page);
}

function renderRsvp(started: boolean) {
  return renderToStaticMarkup(
    createElement(RsvpForm, {
      token: "tok-1",
      current: "WAITLISTED",
      plusOnes: 0,
      dietary: null,
      allowPlusOnes: true,
      started,
    }),
  );
}

describe("what the waitlist promises", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventFind.mockResolvedValue(EVENT);
    mocks.seatFree.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("promises automatic entry to someone joining a full night before it starts", async () => {
    mocks.registrationState.mockResolvedValue("none");

    const html = await renderPage(BEFORE);

    expect(html).toContain("Join the waitlist and you’re in automatically when a spot opens");
    expect(html).toContain("You’ll be let in automatically when a spot opens.");
  });

  // Mid-night the line doesn't move by itself; only the host lets people in.
  it("says the host can let them in once the night has started", async () => {
    mocks.registrationState.mockResolvedValue("none");

    const html = await renderPage(DURING);

    expect(html).toContain("Join the waitlist and the host can let you in if a spot opens");
    expect(html).toContain("The host can let you in if a spot opens.");
    expect(html).not.toContain("automatically");
  });

  it("tells someone already waiting what to expect, before and after the start", async () => {
    mocks.registrationState.mockResolvedValue("waitlisted");

    const before = await renderPage(BEFORE);
    const during = await renderPage(DURING);

    expect(before).toContain("When a spot opens you’re in automatically — we’ll tell you at grace@example.com.");
    expect(during).toContain("If a spot opens the host can let you in — we’ll tell you at grace@example.com.");
    expect(during).not.toContain("automatically");
  });

  it("tells a waitlisted guest on their invitation link the same", () => {
    expect(renderRsvp(false)).toContain("You&#x27;ll be let in automatically when a spot opens.");
    const during = renderRsvp(true);
    expect(during).toContain("The host can let you in if a spot opens.");
    expect(during).not.toContain("automatically");
  });
});
