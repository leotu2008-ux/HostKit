import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  createEvent: vi.fn(),
  currentProfile: vi.fn(),
  afterPublish: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.findUnique },
    accountToken: { findFirst: mocks.findFirst },
    event: { findUniqueOrThrow: mocks.findUniqueOrThrow },
  },
}));

vi.mock("@/lib/session", () => ({
  currentProfile: mocks.currentProfile,
}));

vi.mock("@/lib/event-create", () => ({
  createEventWithPlan: mocks.createEvent,
}));

vi.mock("@/lib/publish", () => ({
  afterPublish: mocks.afterPublish,
}));

import { POST } from "@/app/api/v1/events/route";
import { issueToken } from "@/lib/api/token";

const SECRET = "test-secret-for-revoke";
const ISSUED_AT = Date.UTC(2026, 8, 24, 12, 0, 0);

function account() {
  return {
    id: "user_1",
    name: "Sam",
    email: "sam@babson.edu",
    schoolDomain: "babson.edu",
    classYear: null,
    bio: null,
    company: null,
    xHandle: null,
    linkedinHandle: null,
    instagramHandle: null,
    imageUrl: null,
    phone: null,
    phoneVerifiedAt: null,
    emailVerifiedAt: new Date("2026-01-01"),
    approvedAt: new Date("2026-09-23"),
    sessionVersion: 2,
  };
}

function nightRequest(token: string) {
  return new Request("http://localhost/api/v1/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Mixer",
      type: "MIXER",
      durationHours: 2,
      capacity: 40,
      city: "Boston, MA",
      ticketType: "FREE",
      visibility: "PUBLIC",
    }),
  });
}

describe("POST /api/v1/events agent revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = SECRET;
    mocks.findUnique.mockResolvedValue(account());
    mocks.findFirst.mockResolvedValue({ usedAt: new Date(ISSUED_AT + 1_000) });
    mocks.currentProfile.mockResolvedValue(null);
    mocks.createEvent.mockResolvedValue({ id: "evt_1" });
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: "evt_1",
      title: "Mixer",
      type: "MIXER",
      kind: null,
      description: null,
      vibe: null,
      city: "Boston, MA",
      address: null,
      lat: null,
      lng: null,
      date: null,
      durationHours: 2,
      guestCount: 40,
      budgetTotalCents: 0,
      ticketType: "FREE",
      ticketPriceCents: 0,
      visibility: "PUBLIC",
      published: false,
      ownerId: "user_1",
      schoolDomain: "babson.edu",
      owner: { name: "Sam" },
      club: null,
    });
    mocks.afterPublish.mockResolvedValue(undefined);
  });

  it("returns 401 for a bearer issued at or before the revoke cutoff", async () => {
    const token = issueToken("user_1", 2, ISSUED_AT);

    const res = await POST(nightRequest(token));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in first." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1", kind: "agent-revoke" }),
      }),
    );
  });

  it("returns 201 for an approved account's token issued after the revoke", async () => {
    const revokedAt = new Date(ISSUED_AT + 1_000);
    mocks.findFirst.mockResolvedValue({ usedAt: revokedAt });
    const token = issueToken("user_1", 2, revokedAt.getTime() + 5_000);

    const res = await POST(nightRequest(token));

    expect(res.status).toBe(201);
    expect((await res.json()).event).toMatchObject({ id: "evt_1", title: "Mixer" });
    expect(mocks.createEvent).toHaveBeenCalledOnce();
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user_1", claimToken: null, published: false }),
    );
  });
});
