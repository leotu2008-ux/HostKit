import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn(), eventFindMany: vi.fn(), activityFindMany: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({
  db: { event: { findMany: mocks.eventFindMany }, activity: { findMany: mocks.activityFindMany } },
}));

import { DECISION_POINTS, decide, jevEnabled } from "@/lib/ai/decide";
import { checkDraft } from "@/lib/ai/guardrail";
import { classifyKind } from "@/lib/brief-classify";
import { judgeVenues } from "@/lib/ai/venue-judge";
import { rankVenuesForEvent, type VenueRankEvent } from "@/lib/ai/venue-rank";
import { judgeNightCompetition, loadCompetitors } from "@/lib/night-competition";
import { phraseBriefing } from "@/lib/ai/briefing-voice";
import { digestNotice, type Briefing } from "@/lib/agent/briefing";
import { rankVenues } from "@/lib/venues/rank";
import type { VenueResult } from "@/lib/venues/types";

/**
 * The branch's safety promise: with JEV_DECISIONS unset, every entry point
 * behaves as main does and nothing calls Jev, even on a server that has the
 * gateway key. Everything here reads the real process environment and the
 * global fetch, the way the app does, rather than injected ones.
 */

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  mocks.record.mockReset();
  mocks.eventFindMany.mockReset().mockResolvedValue([]);
  mocks.activityFindMany.mockReset().mockResolvedValue([]);
  vi.stubEnv("AI_GATEWAY_API_KEY", "gw-key-present");
  vi.stubEnv("JEV_DECISIONS", undefined);
  vi.stubEnv("ANTHROPIC_API_KEY", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response("{}", { status: 500 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const venue = (id: string, name: string): VenueResult => ({
  id,
  name,
  address: "1 Main St",
  phone: "+1 617 555 0100",
  website: null,
  lat: 42.36,
  lng: -71.06,
  category: "Bar",
});
const CANDIDATES = [venue("a", "Alpha"), venue("b", "Beta")];
const EVENT: VenueRankEvent = {
  type: "MIXER",
  city: "Boston, MA",
  guestCount: 40,
  durationHours: 3,
  date: null,
  lat: 42.36,
  lng: -71.06,
  venueAllocatedCents: null,
};
const NIGHT = {
  id: "evt-1",
  city: "Boston, MA",
  date: new Date("2026-10-09T19:00:00Z"),
  ownerId: "host-1",
  seriesId: null,
  type: "MIXER" as const,
  kind: "founders mixer",
};

describe("with JEV_DECISIONS unset", () => {
  it("has every point off, even with the gateway key set", () => {
    for (const point of DECISION_POINTS) expect(jevEnabled(point)).toBe(false);
  });

  it("answers null from decide() for every point without a request", async () => {
    for (const point of DECISION_POINTS) {
      expect(await decide(point, "state", { q: { type: "noul", instructions: "?" } })).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  it("plans unknown words as a mixer, as main does", async () => {
    expect(await classifyKind("evt-1", "crawfish boil")).toEqual({ type: "MIXER", source: "fallback" });
    expect(await classifyKind("evt-1", "pitch night")).toEqual({ type: "PITCH_NIGHT", source: "keywords" });
  });

  it("checks no drafts", async () => {
    expect(await checkDraft("We have about five grand.", { eventId: "evt-1", subject: "digest", allowedNumbers: [] })).toBeNull();
  });

  it("ranks venues exactly as main's fallback does", async () => {
    expect(await judgeVenues(CANDIDATES, EVENT, { eventId: "evt-1" })).toBeNull();
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, { eventId: "evt-1" });
    expect(source).toBe("fallback");
    expect(venues).toEqual(rankVenues(CANDIDATES, { type: "MIXER", guestCount: 40, date: null, lat: 42.36, lng: -71.06 }));
  });

  it("judges no competing nights and looks nothing up", async () => {
    expect(await judgeNightCompetition(NIGHT)).toBe(0);
    expect(await loadCompetitors(NIGHT)).toEqual([]);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
    expect(mocks.activityFindMany).not.toHaveBeenCalled();
  });

  it("phrases the digest as main does", async () => {
    const briefing: Briefing = { eventId: "evt-1", items: [], counts: { now: 0, soon: 0, total: 0 }, headline: "" };
    const { notice, source } = await phraseBriefing(briefing, "Founders mixer");
    expect(source).toBe("fallback");
    expect(notice).toEqual(digestNotice(briefing, "Founders mixer"));
  });

  it("made no Jev request and wrote no decision rows across all of the above", async () => {
    await classifyKind("evt-1", "crawfish boil");
    await checkDraft("text", { eventId: "evt-1", subject: "digest", allowedNumbers: [] });
    await rankVenuesForEvent(CANDIDATES, EVENT, { eventId: "evt-1" });
    await judgeNightCompetition(NIGHT);
    expect(calls.filter((url) => url.includes("ai-gateway.vercel.sh") || url.includes("typesafe"))).toEqual([]);
    expect(calls).toEqual([]);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
