import { beforeEach, describe, expect, it, vi } from "vitest";

type Venue = { id: string; name: string; detail: string | null; source: string; status: string };

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  venues: [] as Venue[],
  collaboratorUpdate: vi.fn(),
  collaboratorCreate: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/agent/run", () => ({ runAgent: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    event: { update: mocks.eventUpdate },
    eventCollaborator: {
      // Every VENUE row on the event, in the order they were added. A query
      // that doesn't say which one it wants gets the first.
      findFirst: async () => mocks.venues[0] ?? null,
      findMany: async () => mocks.venues,
      update: mocks.collaboratorUpdate,
      create: mocks.collaboratorCreate,
    },
  },
}));

import { saveBriefAction } from "@/lib/actions/brief";

const event = {
  id: "evt-1",
  ownerId: "host-1",
  title: "Pitch night",
  kind: "Pitch night",
  type: "MIXER",
  date: null,
  durationHours: 3,
  city: "Boston",
  guestCount: 40,
  budgetTotalCents: 0,
  description: null,
  address: null,
};

function form(address: string) {
  const data = new FormData();
  data.set("eventId", "evt-1");
  data.set("address", address);
  return data;
}

describe("saveBriefAction's venue address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event });
  });

  it("leaves the agent's unpicked venue options alone and records the host's own", async () => {
    mocks.venues = [
      { id: "opt-1", name: "The Loft", detail: "12 Main St", source: "APPLE_MAPS", status: "PENDING" },
      { id: "opt-2", name: "Cafe Bar", detail: "40 Elm St", source: "APPLE_MAPS", status: "PENDING" },
    ];

    await saveBriefAction(undefined, form("5 Oak Rd"));

    expect(mocks.collaboratorUpdate).not.toHaveBeenCalled();
    expect(mocks.collaboratorCreate).toHaveBeenCalledWith({
      data: { eventId: "evt-1", kind: "VENUE", name: "5 Oak Rd", detail: "5 Oak Rd", source: "MANUAL" },
    });
  });

  it("writes the address onto the venue the host named, not an earlier option", async () => {
    mocks.venues = [
      { id: "opt-1", name: "The Loft", detail: "12 Main St", source: "APPLE_MAPS", status: "PENDING" },
      { id: "mine", name: "Grandma's house", detail: null, source: "MANUAL", status: "PENDING" },
    ];

    await saveBriefAction(undefined, form("5 Oak Rd"));

    expect(mocks.collaboratorUpdate).toHaveBeenCalledWith({ where: { id: "mine" }, data: { detail: "5 Oak Rd" } });
    expect(mocks.collaboratorCreate).not.toHaveBeenCalled();
  });

  it("corrects the venue picked on Create, whose address is already the night's", async () => {
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event: { ...event, address: "12 Main St" } });
    mocks.venues = [
      { id: "picked", name: "The Loft", detail: "12 Main St", source: "APPLE_MAPS", status: "PENDING" },
    ];

    await saveBriefAction(undefined, form("12 Main St, Unit 4"));

    expect(mocks.collaboratorUpdate).toHaveBeenCalledWith({ where: { id: "picked" }, data: { detail: "12 Main St, Unit 4" } });
    expect(mocks.collaboratorCreate).not.toHaveBeenCalled();
  });

  it("writes the address onto a venue option the host confirmed", async () => {
    mocks.venues = [
      { id: "opt-1", name: "The Loft", detail: "12 Main St", source: "APPLE_MAPS", status: "DECLINED" },
      { id: "opt-2", name: "Cafe Bar", detail: "40 Elm St", source: "APPLE_MAPS", status: "CONFIRMED" },
    ];

    await saveBriefAction(undefined, form("40 Elm Street"));

    expect(mocks.collaboratorUpdate).toHaveBeenCalledWith({ where: { id: "opt-2" }, data: { detail: "40 Elm Street" } });
  });
});
