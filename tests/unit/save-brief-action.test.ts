import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Venue = { id: string; name: string; detail: string | null; source: string; status: string };

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  venues: [] as Venue[],
  collaboratorUpdate: vi.fn(),
  collaboratorCreate: vi.fn(),
  eventUpdate: vi.fn(),
  promoteWaitlist: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/agent/run", () => ({ runAgent: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: vi.fn() }));
vi.mock("@/lib/waitlist", () => ({ promoteWaitlist: mocks.promoteWaitlist }));
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

import { saveBriefAction, setEventTypeAction } from "@/lib/actions/brief";

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

describe("saveBriefAction's capacity", () => {
  function capacity(guestCount: string) {
    const data = new FormData();
    data.set("eventId", "evt-1");
    data.set("guestCount", guestCount);
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.venues = [];
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event });
  });

  // Ten more seats on a full night: the people waiting shouldn't keep waiting.
  it("lets the waitlist in when the host makes room for more people", async () => {
    await saveBriefAction(undefined, capacity("50"));

    expect(mocks.promoteWaitlist).toHaveBeenCalledWith("evt-1");
  });

  it("leaves the waitlist alone when capacity stays or shrinks", async () => {
    await saveBriefAction(undefined, capacity("40"));
    await saveBriefAction(undefined, capacity("30"));

    expect(mocks.promoteWaitlist).not.toHaveBeenCalled();
  });
});

describe("saveBriefAction's planning type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.venues = [];
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function kindForm(kind: string) {
    const data = new FormData();
    data.set("eventId", "evt-1");
    data.set("kind", kind);
    return data;
  }

  /** Jev, over the network the action really uses, picking one type. */
  function jevPicks(choice: string, confidence: number) {
    vi.stubEnv("TYPESAFE_API_KEY", "ts-test-key");
    vi.stubEnv("JEV_DECISIONS", "brief");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            model: "jev-1.13",
            answers: { eventType: { type: "choice", choice, confidence, probabilities: {} } },
            usage: { input_tokens: 10, output_tokens: 1 },
          }),
          { status: 200 },
        ),
      ),
    );
  }

  it("still plans words it doesn't know as a mixer when Jev is off", async () => {
    await saveBriefAction(undefined, kindForm("crawfish boil"));
    expect(mocks.eventUpdate.mock.calls[0][0].data).toMatchObject({ kind: "crawfish boil", type: "MIXER" });
  });

  it("saves Jev's confident pick for words the keyword table doesn't know", async () => {
    jevPicks("DINNER_PARTY", 0.93);
    await saveBriefAction(undefined, kindForm("crawfish boil"));
    expect(mocks.eventUpdate.mock.calls[0][0].data).toMatchObject({ type: "DINNER_PARTY" });
  });

  it("keeps the mixer when Jev isn't sure", async () => {
    jevPicks("DINNER_PARTY", 0.4);
    await saveBriefAction(undefined, kindForm("crawfish boil"));
    expect(mocks.eventUpdate.mock.calls[0][0].data).toMatchObject({ type: "MIXER" });
  });
});

describe("setEventTypeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event });
  });

  function typeForm(type: string) {
    const data = new FormData();
    data.set("eventId", "evt-1");
    data.set("type", type);
    return data;
  }

  it("sets the type the host chose from the briefing", async () => {
    await setEventTypeAction(typeForm("DINNER_PARTY"));
    expect(mocks.eventUpdate).toHaveBeenCalledWith({ where: { id: "evt-1" }, data: { type: "DINNER_PARTY" } });
  });

  it("ignores a type that isn't one", async () => {
    await setEventTypeAction(typeForm("WEDDING"));
    expect(mocks.requireEvent).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });
});
