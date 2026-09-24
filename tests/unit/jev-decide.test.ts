import { beforeEach, describe, expect, it, vi } from "vitest";
import { choice, noul, score } from "@typesafe-ai/sdk";

const mocks = vi.hoisted(() => ({ record: vi.fn(), activityFindMany: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => ({ db: { activity: { findMany: mocks.activityFindMany } } }));

import {
  JEV_MAX_IN_FLIGHT,
  decide,
  jevEnabled,
  jevPoints,
  loadDecisions,
  logDecision,
  picked,
  readDecision,
  scored,
  summarize,
  yesNo,
} from "@/lib/ai/decide";

const ON = { TYPESAFE_API_KEY: "ts-test-key", JEV_DECISIONS: "venue,brief" };

const QUESTIONS = {
  rentsPrivate: noul("The venue rents out a private space for groups."),
  spaceKind: choice("What kind of space is it?", { bar: "A bar", hall: "An event hall" }),
  fit: score("How well does it fit?", ["Poor", "Fair", "Good"]),
};

const GOOD_ANSWERS = {
  rentsPrivate: { type: "noul", noul: 0.92 },
  spaceKind: { type: "choice", choice: "hall", confidence: 0.81, probabilities: { bar: 0.19, hall: 0.81 } },
  fit: { type: "score", score: 1.8, confidence: 0.7, legend: {}, probabilities: {} },
};

/** A fetch that answers like POST /v1/systemone, and records what it was sent. */
function jevSays(answers: unknown, sent: unknown[] = []): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ model: "jev-1.13", answers, usage: { input_tokens: 42, output_tokens: 3 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

/** A fetch that never answers until it's aborted. */
const hangs = ((_url: string, init?: RequestInit) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })) as unknown as typeof fetch;

beforeEach(() => {
  mocks.record.mockReset();
  mocks.activityFindMany.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("which points are on", () => {
  it("reads a comma-separated allowlist and ignores names it doesn't know", () => {
    expect([...jevPoints({ JEV_DECISIONS: " Venue, competing,nonsense" })].sort()).toEqual(["competing", "venue"]);
  });

  it("is all off when the list is empty or there's no key", () => {
    expect(jevPoints({}).size).toBe(0);
    expect(jevEnabled("venue", { JEV_DECISIONS: "venue" })).toBe(false);
    expect(jevEnabled("venue", ON)).toBe(true);
    expect(jevEnabled("guardrail", ON)).toBe(false);
  });
});

describe("decide", () => {
  it("returns the typed answers, the model and the token count when Jev answers", async () => {
    const sent: unknown[] = [];
    const decision = await decide("venue", { name: "Lakeside Hall" }, QUESTIONS, {
      env: ON,
      fetch: jevSays(GOOD_ANSWERS, sent),
    });
    expect(decision?.answers.rentsPrivate.noul).toBe(0.92);
    expect(decision?.answers.spaceKind.choice).toBe("hall");
    expect(decision?.model).toBe("jev-1.13");
    expect(decision?.inputTokens).toBe(42);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ state: { name: "Lakeside Hall" } });
  });

  it("returns null without calling out when the point is off or there's no key", async () => {
    const sent: unknown[] = [];
    const fetchImpl = jevSays(GOOD_ANSWERS, sent);
    expect(await decide("guardrail", "text", QUESTIONS, { env: ON, fetch: fetchImpl })).toBeNull();
    expect(await decide("venue", "text", QUESTIONS, { env: { JEV_DECISIONS: "venue" }, fetch: fetchImpl })).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("returns null, not a throw, when the API errors", async () => {
    const failing = (async () =>
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })) as unknown as typeof fetch;
    await expect(decide("venue", "text", QUESTIONS, { env: ON, fetch: failing })).resolves.toBeNull();
  });

  it("gives up at the timeout and returns null", async () => {
    const started = Date.now();
    const decision = await decide("venue", "text", QUESTIONS, {
      env: { ...ON, JEV_TIMEOUT_MS: "50" },
      fetch: hangs,
    });
    expect(decision).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("uses the caller's smaller budget as the timeout", async () => {
    const decision = await decide("venue", "text", QUESTIONS, { env: ON, fetch: hangs, budgetMs: 30 });
    expect(decision).toBeNull();
  });

  it("rejects an answer that doesn't match its question", async () => {
    const offList = { ...GOOD_ANSWERS, spaceKind: { ...GOOD_ANSWERS.spaceKind, choice: "rooftop" } };
    const outOfRange = { ...GOOD_ANSWERS, rentsPrivate: { type: "noul", noul: 1.4 } };
    const missing = { rentsPrivate: GOOD_ANSWERS.rentsPrivate, spaceKind: GOOD_ANSWERS.spaceKind };
    for (const answers of [offList, outOfRange, missing]) {
      expect(await decide("venue", "text", QUESTIONS, { env: ON, fetch: jevSays(answers) })).toBeNull();
    }
  });

  it(`never has more than ${JEV_MAX_IN_FLIGHT} calls in flight`, async () => {
    let now = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const gated = (async () => {
      now += 1;
      peak = Math.max(peak, now);
      await new Promise<void>((resolve) => releases.push(resolve));
      now -= 1;
      return new Response(JSON.stringify({ model: "jev-1.13", answers: GOOD_ANSWERS, usage: { input_tokens: 1, output_tokens: 1 } }));
    }) as unknown as typeof fetch;

    const calls = Array.from({ length: 20 }, () =>
      decide("venue", "text", QUESTIONS, { env: { ...ON, JEV_TIMEOUT_MS: "5000" }, fetch: gated }),
    );
    // Let every call that can start, start.
    while (releases.length < JEV_MAX_IN_FLIGHT) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(releases).toHaveLength(JEV_MAX_IN_FLIGHT);
    // Drain everything, a few at a time, so queued calls get their turn.
    for (let done = 0; done < 20; ) {
      const batch = releases.splice(0);
      batch.forEach((release) => release());
      done += batch.length;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const results = await Promise.all(calls);
    expect(peak).toBe(JEV_MAX_IN_FLIGHT);
    expect(results.every((result) => result !== null)).toBe(true);
  });
});

describe("verdicts", () => {
  it("reads a noul against the point's own yes and no bands", () => {
    const band = { yesAt: 0.8, noAt: 0.2 };
    expect(yesNo({ type: "noul", noul: 0.85 }, band)).toBe("yes");
    expect(yesNo({ type: "noul", noul: 0.1 }, band)).toBe("no");
    expect(yesNo({ type: "noul", noul: 0.5 }, band)).toBe("unsure");
  });

  it("treats a choice or score below the point's threshold as unsure", () => {
    const answer = GOOD_ANSWERS.spaceKind as Parameters<typeof picked>[0];
    expect(picked(answer, 0.8)).toBe("hall");
    expect(picked(answer, 0.9)).toBe("unsure");
    const fit = GOOD_ANSWERS.fit as unknown as Parameters<typeof scored>[0];
    expect(scored(fit, 0.6)).toBe(1.8);
    expect(scored(fit, 0.75)).toBe("unsure");
  });
});

describe("the decision log", () => {
  it("writes one quiet activity row with the answers, the model and whether it fell back", async () => {
    await logDecision("evt-1", {
      point: "venue",
      subject: "Lakeside Hall",
      answers: summarize(GOOD_ANSWERS as Parameters<typeof summarize>[0]),
      verdict: "ranked",
      model: "jev-1.13",
      fellBack: false,
      ms: 180,
      inputTokens: 42,
    });
    expect(mocks.record).toHaveBeenCalledTimes(1);
    const [eventId, line] = mocks.record.mock.calls[0];
    expect(eventId).toBe("evt-1");
    expect(line).toMatchObject({ actor: "system", kind: "decision", title: "venue: ranked" });
    const body = readDecision(line.body);
    expect(body).toMatchObject({
      point: "venue",
      subject: "Lakeside Hall",
      model: "jev-1.13",
      fellBack: false,
      answers: {
        rentsPrivate: { p: 0.92 },
        spaceKind: { answer: "hall", confidence: 0.81 },
        fit: { answer: 1.8, confidence: 0.7 },
      },
    });
  });

  it("reads back only well-formed rows for the point asked about", async () => {
    const at = new Date("2026-09-24T12:00:00Z");
    mocks.activityFindMany.mockResolvedValue([
      { body: JSON.stringify({ point: "brief", verdict: "unsure", answers: {}, model: null, fellBack: true }), createdAt: at },
      { body: "not json", createdAt: at },
    ]);
    const rows = await loadDecisions("evt-1", "brief");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ point: "brief", verdict: "unsure", at });
    expect(mocks.activityFindMany.mock.calls[0][0].where).toMatchObject({
      eventId: "evt-1",
      kind: "decision",
      title: { startsWith: "brief:" },
    });
  });
});
