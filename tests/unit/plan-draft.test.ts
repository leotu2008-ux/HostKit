import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftPlan } from "@/lib/ai/plan-draft";
import { DAY_MS, generatePlan, startOfDay } from "@/lib/plan";
import type { PlanInput } from "@/lib/plan";

/** A fetch that answers exactly once, the way the Messages API would. Mirrors
 *  tests/unit/ai-client.test.ts's stub rather than inventing a new one. */
function replyWith(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function modelSays(text: string): typeof fetch {
  return replyWith({ content: [{ type: "text", text }] });
}

/** modelSays, plus the request bodies it was asked with — the only way to
 *  assert what actually reached the prompt. */
function capturing(text: string): { fetchImpl: typeof fetch; bodies: string[] } {
  const bodies: string[] = [];
  const fetchImpl = ((_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return Promise.resolve(
      new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

const NOW = new Date("2026-01-15T09:30:00");
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

// MIXER's template horizon is 21 days; booking the event exactly 21 days out
// means the runway is uncompressed, so horizonDays is the template's own
// number and not something this test has to derive from the implementation.
const input: PlanInput & { title: string; city: string; guestCount: number } = {
  type: "MIXER",
  date: inDays(21),
  budgetTotalCents: 500_000,
  title: "Fall Mixer",
  city: "Boston",
  guestCount: 60,
};

const goodDraft = {
  tasks: [
    { title: "Book the room", at: 1, category: "VENUE" },
    { title: "Pick a theme", at: 0.6 },
    { title: "Order snacks", at: 0.2, category: "CATERING" },
  ],
  budget: [
    { category: "VENUE", weight: 0.6 },
    { category: "CATERING", weight: 0.4 },
  ],
};

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  delete process.env.AI_MODEL;
});

afterEach(() => {
  if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved;
  delete process.env.AI_MODEL;
  vi.restoreAllMocks();
});

describe("draftPlan — a good model answer", () => {
  it("sums the budget to exactly budgetTotalCents and reports source: model", async () => {
    const { plan, source } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(goodDraft)),
    });
    expect(source).toBe("model");
    const total = plan.categories.reduce((a, c) => a + c.allocatedCents, 0);
    expect(total).toBe(input.budgetTotalCents);
  });
});

describe("draftPlan — the budget invariant", () => {
  it("still sums exactly when the model's weights sum to less than 1", async () => {
    const draft = {
      ...goodDraft,
      budget: [
        { category: "VENUE", weight: 0.5 },
        { category: "CATERING", weight: 0.4 },
      ], // sums to 0.9
    };
    const { plan } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });
    const total = plan.categories.reduce((a, c) => a + c.allocatedCents, 0);
    expect(total).toBe(input.budgetTotalCents);
  });

  it("still sums exactly when the model's weights sum to more than 1", async () => {
    const draft = {
      ...goodDraft,
      budget: [
        { category: "VENUE", weight: 0.9 },
        { category: "CATERING", weight: 0.6 },
      ], // sums to 1.5
    };
    const { plan } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });
    const total = plan.categories.reduce((a, c) => a + c.allocatedCents, 0);
    expect(total).toBe(input.budgetTotalCents);
  });
});

describe("draftPlan — validating the model's answer", () => {
  it("falls back, exactly to generatePlan's own result, on a category that doesn't exist", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const draft = {
      tasks: goodDraft.tasks,
      budget: [{ category: "CRAFT_SERVICES", weight: 1 }],
    };
    const { plan, source } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });
    expect(source).toBe("fallback");
    expect(plan).toEqual(generatePlan(input, NOW));
  });

  it("falls back, exactly to generatePlan's own result, on a duplicate budget category", async () => {
    // BudgetCategory is unique per (eventId, category) — a model repeating a
    // category would throw at createMany and roll back event creation, so
    // this must be caught here rather than reach the database.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const draft = {
      tasks: goodDraft.tasks,
      budget: [
        { category: "VENUE", weight: 0.6 },
        { category: "VENUE", weight: 0.4 },
      ],
    };
    const { plan, source } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });
    expect(source).toBe("fallback");
    expect(plan).toEqual(generatePlan(input, NOW));
  });

  it("falls back on an answer with only one task", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const draft = { tasks: [goodDraft.tasks[0]], budget: goodDraft.budget };
    const { plan, source } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });
    expect(source).toBe("fallback");
    expect(plan).toEqual(generatePlan(input, NOW));
  });
});

describe("draftPlan — the host's own words for the event", () => {
  it("reaches the prompt, so an unrecognised kind isn't invisible to the model", async () => {
    // eventTypeForKind maps nothing to "silent disco", so MIXER is all the
    // type carries — the kind text is the only place the real event is.
    const { fetchImpl, bodies } = capturing(JSON.stringify(goodDraft));
    const { source } = await draftPlan({ ...input, kind: "silent disco" }, { now: NOW, fetchImpl });
    expect(source).toBe("model");
    expect(bodies[0]).toContain("Host's own words for this event: silent disco");
  });

  it("is left out of the prompt entirely when the host hasn't said one", async () => {
    const { fetchImpl, bodies } = capturing(JSON.stringify(goodDraft));
    await draftPlan(input, { now: NOW, fetchImpl });
    expect(bodies[0]).not.toContain("Host's own words");
  });

  it("still yields a usable plan for an unrecognised kind with no model configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { plan, source } = await draftPlan({ ...input, kind: "silent disco" }, { now: NOW });
    expect(source).toBe("fallback");
    // The heuristic floor: the template for the event's type, unchanged by a
    // kind it has never heard of.
    expect(plan).toEqual(generatePlan(input, NOW));
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.categories.length).toBeGreaterThan(0);
  });
});

describe("draftPlan — being switched off", () => {
  it("falls back without a key, and says so", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { source } = await draftPlan(input, { now: NOW });
    expect(source).toBe("fallback");
  });
});

describe("draftPlan — the at-to-date conversion", () => {
  it("lands at=1 on the first day of the runway and at=0 on the last", async () => {
    const draft = {
      tasks: [
        { title: "Kickoff", at: 1 },
        { title: "Middle task", at: 0.5 },
        { title: "Day of", at: 0 },
      ],
      budget: goodDraft.budget,
    };
    const { plan } = await draftPlan(input, {
      now: NOW,
      fetchImpl: modelSays(JSON.stringify(draft)),
    });

    // The runway is uncompressed at exactly 21 days out, so it equals
    // MIXER's own template horizon — asserted directly, not read back off
    // the plan under test.
    expect(plan.horizonDays).toBe(21);

    const kickoff = plan.tasks.find((t) => t.title === "Kickoff")!;
    const dayOf = plan.tasks.find((t) => t.title === "Day of")!;

    expect(kickoff.offsetDays).toBe(21);
    expect(dayOf.offsetDays).toBe(0);

    // Built from NOW and the event date directly, independent of the
    // offsetDays the implementation produced above.
    expect(kickoff.dueDate).toEqual(startOfDay(NOW));
    expect(dayOf.dueDate).toEqual(startOfDay(input.date!));
  });
});
