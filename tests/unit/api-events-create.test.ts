import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiBearer: vi.fn(),
  apiUser: vi.fn(),
  currentProfile: vi.fn(),
  createEvent: vi.fn(),
  findEvent: vi.fn(),
  afterPublish: vi.fn(),
  updateMany: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: {
      findUniqueOrThrow: mocks.findEvent,
      updateMany: mocks.updateMany,
      create: mocks.eventCreate,
    },
  },
}));

vi.mock("@/lib/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/http")>();
  return {
    ...actual,
    apiBearer: mocks.apiBearer,
    apiUser: mocks.apiUser,
  };
});

vi.mock("@/lib/session", () => ({
  currentProfile: mocks.currentProfile,
}));

vi.mock("@/lib/event-create", () => ({
  createEventWithPlan: mocks.createEvent,
}));

vi.mock("@/lib/publish", () => ({
  afterPublish: mocks.afterPublish,
}));

import { POST as createEvent } from "@/app/api/v1/events/route";
import { POST as claimDrafts } from "@/app/api/v1/drafts/claim/route";

const approved = {
  id: "u1",
  email: "sam@babson.edu",
  name: "Sam Okafor",
  approvedAt: new Date("2026-09-23T00:00:00Z"),
  schoolDomain: "babson.edu",
};

const unapproved = {
  id: "u2",
  email: "sam@babson.edu",
  name: "Sam Okafor",
  approvedAt: null,
  schoolDomain: null,
};

function nightRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
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

function savedEvent(ownerId: string) {
  return {
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
    ownerId,
    schoolDomain: "babson.edu",
    owner: { name: "Sam" },
    club: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiBearer.mockResolvedValue(null);
  mocks.apiUser.mockResolvedValue(null);
  mocks.currentProfile.mockResolvedValue(null);
  mocks.createEvent.mockResolvedValue({ id: "evt_1" });
  mocks.findEvent.mockImplementation(async () => savedEvent("u1"));
  mocks.afterPublish.mockResolvedValue(undefined);
  mocks.updateMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/v1/events", () => {
  it("returns 401 and creates nothing when there is no session or bearer", async () => {
    const res = await createEvent(nightRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in first." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("returns 403 for a bearer account without dashboard access", async () => {
    mocks.apiBearer.mockResolvedValue(unapproved);

    const res = await createEvent(nightRequest({ authorization: "Bearer t" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Join the waitlist." });
    expect(mocks.currentProfile).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("returns 403 for a signed-in session without dashboard access", async () => {
    mocks.currentProfile.mockResolvedValue(unapproved);

    const res = await createEvent(nightRequest());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Join the waitlist." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("creates an owned event for an approved bearer and does not mint a claim token", async () => {
    mocks.apiBearer.mockResolvedValue(approved);

    const res = await createEvent(nightRequest({ authorization: "Bearer t" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.claimToken).toBeUndefined();
    expect(body.event).toMatchObject({ id: "evt_1", title: "Mixer" });
    expect(mocks.createEvent).toHaveBeenCalledOnce();
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "u1",
        claimToken: null,
        schoolDomain: "babson.edu",
        published: false,
        title: "Mixer",
      }),
    );
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("creates an owned event for an approved website session", async () => {
    mocks.currentProfile.mockResolvedValue(approved);

    const res = await createEvent(nightRequest());

    expect(res.status).toBe(201);
    expect((await res.json()).claimToken).toBeUndefined();
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "u1", claimToken: null }),
    );
  });
});

describe("POST /api/v1/drafts/claim", () => {
  it("attaches an existing claim token and does not create an event", async () => {
    mocks.apiUser.mockResolvedValue(approved);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const res = await claimDrafts(
      new Request("http://localhost/api/v1/drafts/claim", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: JSON.stringify({ drafts: [{ id: "evt_old", token: "abc" }] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ claimed: ["evt_old"] });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_old", claimToken: "abc", ownerId: null },
      data: { ownerId: "u1", schoolDomain: "babson.edu" },
    });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("leaves an unknown token unclaimed instead of creating a night", async () => {
    mocks.apiUser.mockResolvedValue(approved);
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const res = await claimDrafts(
      new Request("http://localhost/api/v1/drafts/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drafts: [{ id: "missing", token: "nope" }] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ claimed: [] });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
