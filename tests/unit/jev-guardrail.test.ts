import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));

import { checkDraft, valuesMatchRecord } from "@/lib/ai/guardrail";
import { phraseBriefing } from "@/lib/ai/briefing-voice";
import { rankVenuesForEvent, type VenueRankEvent } from "@/lib/ai/venue-rank";
import { digestNotice, type Briefing } from "@/lib/agent/briefing";
import type { VenueResult } from "@/lib/venues/types";

const JEV_ON = { AI_GATEWAY_API_KEY: "gw-test-key", JEV_DECISIONS: "guardrail" };

type Verdict = { budget: number; values: number };

/** A Jev that judges each message with `judge`, and remembers what it was sent. */
function jev(judge: (message: string) => Verdict, sent: string[] = []): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const message = String(body.state.message);
    sent.push(message);
    const { budget, values } = judge(message);
    return new Response(
      JSON.stringify({
        model: "jev-1.13",
        answers: {
          revealsBudget: { type: "noul", noul: budget },
          statesValues: { type: "noul", noul: values },
        },
        usage: { input_tokens: 30, output_tokens: 2 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

/** Claude, answering with each of `texts` in turn (the last one repeats). */
function claudeSays(...texts: string[]): typeof fetch {
  let call = 0;
  return (async () => {
    const text = texts[Math.min(call, texts.length - 1)];
    call += 1;
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

const CLEAN = { budget: 0.05, values: 0.05 };
const LEAKS = { budget: 0.93, values: 0.4 };

let savedKey: string | undefined;
beforeEach(() => {
  mocks.record.mockReset();
  savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
  vi.restoreAllMocks();
});

function logged() {
  return mocks.record.mock.calls.map(([, line]) => JSON.parse(line.body));
}

describe("the values code can check", () => {
  it("passes digits and words the record holds, and fails ones it doesn't", () => {
    expect(valuesMatchRecord("3 things need you, and it's tomorrow", [3], ["tomorrow"])).toEqual({
      checkable: true,
      grounded: true,
    });
    expect(valuesMatchRecord("8 vendors replied", [3], []).grounded).toBe(false);
    expect(valuesMatchRecord("It's on Friday", [3], ["in 2 days"]).grounded).toBe(false);
    expect(valuesMatchRecord("three tasks left", [3], []).grounded).toBe(true);
  });

  it("says when there's no value it can read at all", () => {
    expect(valuesMatchRecord("we can go a few hundred higher", [], []).checkable).toBe(false);
  });
});

describe("checkDraft", () => {
  const ctx = { eventId: "evt-1", subject: "digest", allowedNumbers: [2], env: JEV_ON };

  it("fails a line that hints at the budget, and logs why", async () => {
    const check = await checkDraft("We're working with about five grand.", {
      ...ctx,
      fetch: jev(() => LEAKS),
    });
    expect(check).toEqual({ verdict: "fail", reason: "it mentions how much the host can spend" });
    expect(logged()[0]).toMatchObject({
      point: "guardrail",
      subject: "digest",
      verdict: "fail",
      model: "jev-1.13",
      fellBack: false,
      answers: { revealsBudget: { p: 0.93 } },
    });
  });

  it("lets Jev spot a stated value and code settle it against the record", async () => {
    const says = jev(() => ({ budget: 0.05, values: 0.95 }));
    expect(await checkDraft("2 things need you today", { ...ctx, allowedPhrases: ["today"], fetch: says })).toEqual({
      verdict: "pass",
    });
    expect(await checkDraft("9 things need you", { ...ctx, fetch: says })).toMatchObject({
      verdict: "fail",
      reason: "it states a value that isn't in the record",
    });
    expect(await checkDraft("Book it for a few hundred", { ...ctx, fetch: says })).toMatchObject({
      verdict: "fail",
      reason: "it states a value in words that can't be checked against the record",
    });
  });

  it("is unsure, not failing, when Jev can't tell", async () => {
    const check = await checkDraft("Worth keeping costs in mind.", {
      ...ctx,
      fetch: jev(() => ({ budget: 0.45, values: 0.1 })),
    });
    expect(check).toEqual({ verdict: "unsure", reason: "it may touch on the budget" });
  });

  it("sends Jev only the message", async () => {
    const sent: string[] = [];
    await checkDraft("Two things need you.", { ...ctx, fetch: jev(() => CLEAN, sent) });
    expect(sent).toEqual(["Two things need you."]);
  });

  it("returns null and logs nothing when the guardrail is off", async () => {
    const check = await checkDraft("anything", { ...ctx, env: {}, fetch: jev(() => LEAKS) });
    expect(check).toBeNull();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("returns null but logs the fallback when Jev is on and doesn't answer", async () => {
    const down = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    expect(await checkDraft("anything", { ...ctx, fetch: down })).toBeNull();
    expect(logged()[0]).toMatchObject({ point: "guardrail", fellBack: true, verdict: "no answer" });
  });
});

describe("the digest line", () => {
  const NOW = new Date("2026-01-15T09:30:00");
  const BRIEFING: Briefing = {
    eventId: "evt-1",
    items: [
      {
        id: "task_due:t1",
        kind: "task_due",
        urgency: "now",
        title: "Confirm headcount",
        detail: "Due Today",
        action: { type: "complete_task", taskId: "t1", label: "Mark done" },
      },
    ],
    counts: { now: 1, soon: 0, total: 1 },
    headline: "1 thing needs you today",
  };
  const opts = { now: NOW, eventDate: new Date(NOW.getTime() + 2 * 86_400_000) };
  const leaky = JSON.stringify({ headline: "Fall Mixer is close", line: "Keep it under about five grand." });
  const clean = JSON.stringify({ headline: "Fall Mixer is close", line: "Confirm headcount is due today." });
  const isLeak = (message: string) => (message.includes("grand") ? LEAKS : CLEAN);

  it("sends a line the guardrail passes, unchanged", async () => {
    const { notice, source } = await phraseBriefing(BRIEFING, "Fall Mixer", {
      ...opts,
      fetchImpl: claudeSays(clean),
      jev: { fetch: jev(isLeak), env: JEV_ON },
    });
    expect(source).toBe("model");
    expect(notice.body).toBe("Confirm headcount is due today.");
  });

  it("writes a failed line once more, told why, and sends the rewrite when it passes", async () => {
    const { notice, source } = await phraseBriefing(BRIEFING, "Fall Mixer", {
      ...opts,
      fetchImpl: claudeSays(leaky, clean),
      jev: { fetch: jev(isLeak), env: JEV_ON },
    });
    expect(source).toBe("model");
    expect(notice.body).toBe("Confirm headcount is due today.");
    expect(logged().map((entry) => entry.verdict)).toEqual(["fail", "pass"]);
  });

  it("sends the line code wrote when the rewrite fails too", async () => {
    const { notice, source } = await phraseBriefing(BRIEFING, "Fall Mixer", {
      ...opts,
      fetchImpl: claudeSays(leaky, leaky),
      jev: { fetch: jev(isLeak), env: JEV_ON },
    });
    expect(source).toBe("fallback");
    expect(notice).toEqual(digestNotice(BRIEFING, "Fall Mixer"));
  });

  it("behaves exactly as before when the guardrail is off", async () => {
    const { notice, source } = await phraseBriefing(BRIEFING, "Fall Mixer", {
      ...opts,
      fetchImpl: claudeSays(leaky),
      jev: { fetch: jev(isLeak), env: {} },
    });
    expect(source).toBe("model");
    expect(notice.body).toBe("Keep it under about five grand.");
  });
});

describe("venue reasons", () => {
  const venue = (id: string, name: string): VenueResult => ({
    id,
    name,
    address: "1 Main St",
    phone: "+1 617 555 0100",
    website: "https://example.com",
    lat: 42.3601,
    lng: -71.0589,
    category: "Bar",
  });
  const CANDIDATES = [venue("a", "Alpha"), venue("b", "Beta"), venue("c", "Gamma")];
  const EVENT: VenueRankEvent = {
    type: "MIXER",
    city: "Boston, MA",
    guestCount: 40,
    durationHours: 3,
    date: null,
    lat: 42.3601,
    lng: -71.0589,
    venueAllocatedCents: 150_000,
  };
  const answer = JSON.stringify({
    picks: [
      { id: "b", reason: "Fits your $1500 venue budget" },
      { id: "a", reason: "Big room for 40 people" },
      { id: "c", reason: "Bar with a back room" },
    ],
  });

  it("swaps a reason the guardrail fails for the plain one, and keeps the rest", async () => {
    const { venues, source } = await rankVenuesForEvent(CANDIDATES, EVENT, {
      fetchImpl: claudeSays(answer),
      eventId: "evt-1",
      jev: {
        fetch: jev((message) =>
          message.includes("budget") ? LEAKS : { budget: 0.05, values: /\d/.test(message) ? 0.9 : 0.05 },
        ),
        env: JEV_ON,
      },
    });
    expect(source).toBe("model");
    expect(venues.map((v) => [v.id, v.reason])).toEqual([
      ["b", "Has a phone number and a site"],
      ["a", "Big room for 40 people"],
      ["c", "Bar with a back room"],
    ]);
  });
});
