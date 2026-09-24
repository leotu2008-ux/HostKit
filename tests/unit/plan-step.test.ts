import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/replan-apply", () => ({
  regenerateTasksAndCategories: vi.fn(async () => ({ tasks: 3, categories: 2 })),
}));

import { applyDraftedPlan, type PlanStepEvent } from "@/lib/agent/plan-step";

const NOW = new Date("2026-01-15T09:30:00");

const event: PlanStepEvent = {
  id: "evt_1",
  title: "Fall Mixer",
  kind: "mixer",
  type: "MIXER",
  date: new Date("2026-02-05T19:00:00"),
  city: "Boston",
  guestCount: 60,
  budgetTotalCents: 500_000,
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

/** A model that answers after `delayMs`, and stops when askOr aborts it. */
function answersAfter(delayMs: number): typeof fetch {
  return ((_url: string, init: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          resolve(
            new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(goodDraft) }] }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          ),
        delayMs,
      );
      init.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    })) as unknown as typeof fetch;
}

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  vi.useFakeTimers({ now: NOW });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("applyDraftedPlan — the run's deadline", () => {
  it("waits for a slow model when the run has its full budget", async () => {
    const pending = applyDraftedPlan(event, { deadline: Date.now() + 45_000, fetchImpl: answersAfter(20_000) });
    await vi.advanceTimersByTimeAsync(20_000);
    const line = await pending;
    expect(line.body).toContain("written for this event");
  });

  it("falls back to the template before the run's deadline, leaving time for the writes", async () => {
    const deadline = Date.now() + 10_000;
    const pending = applyDraftedPlan(event, { deadline, fetchImpl: answersAfter(9_000) });
    await vi.advanceTimersByTimeAsync(8_000);
    const line = await pending;
    expect(line.body).toContain("from the template");
    expect(Date.now()).toBeLessThan(deadline);
  });
});
