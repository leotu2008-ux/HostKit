import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn(), eventFindMany: vi.fn(), activityFindMany: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({
  db: { event: { findMany: mocks.eventFindMany }, activity: { findMany: mocks.activityFindMany } },
}));

import {
  competitorsFrom,
  judgeNightCompetition,
  loadCompetitors,
  sameNightCityEvents,
  stateForCompeting,
  timingPhrase,
  type NightEvent,
} from "@/lib/night-competition";
import { briefingFor } from "@/lib/agent/briefing";

const JEV_ON = { TYPESAFE_API_KEY: "ts-test-key", JEV_DECISIONS: "competing" };

const HOST = {
  id: "evt-1",
  city: "Boston, MA",
  date: new Date("2026-10-09T19:00:00Z"),
  ownerId: "host-1",
  seriesId: "series-1",
  type: "MIXER" as const,
  kind: "founders mixer",
};

const RIVAL: NightEvent = {
  id: "evt-9",
  title: "Startup Drinks",
  type: "MIXER",
  kind: "startup drinks",
  date: new Date("2026-10-09T20:00:00Z"),
};
const RECITAL: NightEvent = { id: "evt-8", title: "Cello Recital", type: "FORMAL", kind: null, date: new Date("2026-10-09T18:00:00Z") };

/** A Jev that judges each other event by its title, remembering what it was sent. */
function jev(byTitle: Record<string, { same: number; pull: number; conf: number } | "down">, sent: unknown[] = []) {
  return (async (_url: string, init?: RequestInit) => {
    const state = JSON.parse(String(init?.body)).state;
    sent.push(state);
    const j = byTitle[state.otherEvent.title];
    if (!j || j === "down") return new Response("{}", { status: 503 });
    return new Response(
      JSON.stringify({
        model: "jev-1.13",
        answers: {
          sameCrowd: { type: "noul", noul: j.same },
          pull: { type: "score", score: j.pull, confidence: j.conf, legend: {}, probabilities: {} },
        },
        usage: { input_tokens: 50, output_tokens: 2 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

const logged = () => mocks.record.mock.calls.map(([, line]) => JSON.parse(line.body));

beforeEach(() => {
  mocks.record.mockReset();
  mocks.eventFindMany.mockReset().mockResolvedValue([RIVAL, RECITAL]);
  mocks.activityFindMany.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("finding what else is on", () => {
  it("reads only other hosts' public, published nights in the same city and window", async () => {
    await sameNightCityEvents(HOST);
    const { where } = mocks.eventFindMany.mock.calls[0][0];
    expect(where).toMatchObject({
      id: { not: "evt-1" },
      city: "Boston, MA",
      published: true,
      visibility: "PUBLIC",
      status: { not: "CANCELLED" },
      NOT: { ownerId: "host-1" },
      OR: [{ seriesId: null }, { seriesId: { not: "series-1" } }],
    });
    expect(where.date.gte.toISOString()).toBe("2026-10-09T16:00:00.000Z");
    expect(where.date.lte.toISOString()).toBe("2026-10-09T22:00:00.000Z");
  });

  it("finds nothing for a night with no date or city", async () => {
    expect(await sameNightCityEvents({ ...HOST, date: null })).toEqual([]);
    expect(await sameNightCityEvents({ ...HOST, city: " " })).toEqual([]);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });

  it("puts the gap between the two starts into words code worked out", () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 9, h, m));
    expect(timingPhrase(at(19), at(19, 15))).toBe("starts at about the same time as yours");
    expect(timingPhrase(at(19), at(20))).toBe("starts about an hour after yours");
    expect(timingPhrase(at(19), at(16))).toBe("starts about 3 hours before yours");
  });

  it("sends titles and kinds, never who hosts either night", () => {
    const state = stateForCompeting(HOST, RIVAL);
    expect(state).toEqual({
      hostEvent: { kind: "Mixer", hostWords: "founders mixer" },
      otherEvent: { title: "Startup Drinks", kind: "Mixer", hostWords: "startup drinks" },
      timing: "starts about an hour after yours",
    });
    expect(JSON.stringify(state)).not.toContain("host-1");
  });
});

describe("judgeNightCompetition", () => {
  it("logs each night's judgment against its id, and counts the ones that compete", async () => {
    const count = await judgeNightCompetition(HOST, {
      env: JEV_ON,
      fetch: jev({ "Startup Drinks": { same: 0.9, pull: 2.4, conf: 0.8 }, "Cello Recital": { same: 0.05, pull: 0.1, conf: 0.9 } }),
    });
    expect(count).toBe(1);
    expect(logged()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ point: "competing", subject: "Startup Drinks", subjectId: "evt-9", verdict: "competes" }),
        expect.objectContaining({ subjectId: "evt-8", verdict: "different crowd" }),
      ]),
    );
  });

  it("calls it unsure, not competition, when Jev can't tell", async () => {
    mocks.eventFindMany.mockResolvedValue([RIVAL]);
    await judgeNightCompetition(HOST, { env: JEV_ON, fetch: jev({ "Startup Drinks": { same: 0.5, pull: 2.5, conf: 0.4 } }) });
    expect(logged()[0]).toMatchObject({ verdict: "unsure" });
  });

  it("logs a fallback for a night Jev didn't answer about", async () => {
    mocks.eventFindMany.mockResolvedValue([RIVAL]);
    await judgeNightCompetition(HOST, { env: JEV_ON, fetch: jev({ "Startup Drinks": "down" }) });
    expect(logged()[0]).toMatchObject({ subjectId: "evt-9", verdict: "no answer", fellBack: true });
  });

  it("does nothing with the point off, and never throws with it on", async () => {
    expect(await judgeNightCompetition(HOST, { env: {} })).toBe(0);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();

    mocks.eventFindMany.mockRejectedValue(new Error("db down"));
    await expect(judgeNightCompetition(HOST, { env: JEV_ON })).resolves.toBe(0);
  });
});

describe("what the briefing surfaces", () => {
  const judged = (subjectId: string, verdict: string, pull: number, at: string) => ({
    point: "competing" as const,
    subject: subjectId,
    subjectId,
    answers: { pull: { answer: pull, confidence: 0.8 } },
    verdict,
    model: "jev-1.13",
    fellBack: false,
    at: new Date(at),
  });

  it("keeps the newest judgment per night, and only nights still on", () => {
    const decisions = [
      judged("evt-9", "competes", 2.2, "2026-10-02"),
      judged("evt-9", "different crowd", 0, "2026-10-01"),
      judged("evt-8", "different crowd", 0.1, "2026-10-02"),
      judged("evt-7", "competes", 3, "2026-10-02"),
    ];
    expect(competitorsFrom(decisions, [RIVAL, RECITAL])).toEqual([{ id: "evt-9", title: "Startup Drinks", pull: 2.2 }]);
  });

  it("doesn't look anything up with the point off", async () => {
    expect(await loadCompetitors(HOST, new Date("2026-10-01"), {})).toEqual([]);
    expect(mocks.activityFindMany).not.toHaveBeenCalled();
  });

  it("shows a card citing only the saved pull level, and only before the night", () => {
    const input = {
      tasks: [],
      inquiries: [],
      collaborators: [{ id: "v", kind: "VENUE" as const, name: "Hall", email: null, status: "CONFIRMED" as const, sentAt: null }],
      competitors: [{ id: "evt-9", title: "Startup Drinks", pull: 2.2 }],
    };
    const before = briefingFor({ id: "evt-1", title: "Founders mixer", date: HOST.date }, { ...input, now: new Date("2026-09-20T12:00:00Z") });
    expect(before.items).toEqual([
      expect.objectContaining({
        kind: "night_competition",
        title: "Also on that night: Startup Drinks",
        detail: "Likely the same crowd; some of your guests might go there instead",
        action: { type: "open_brief", label: "Review the date" },
      }),
    ]);
    const after = briefingFor({ id: "evt-1", title: "Founders mixer", date: HOST.date }, { ...input, now: new Date("2026-10-12T12:00:00Z") });
    expect(after.items.some((item) => item.kind === "night_competition")).toBe(false);
  });
});
