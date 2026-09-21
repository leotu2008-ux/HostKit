import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { phraseBriefing } from "@/lib/ai/briefing-voice";
import { digestNotice, type Briefing } from "@/lib/agent/briefing";

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

const NOW = new Date("2026-01-15T09:30:00");
const EVENT_TITLE = "Fall Mixer";
const EVENT_DATE = new Date(NOW.getTime() + 2 * 86_400_000);

const BRIEFING: Briefing = {
  eventId: "e1",
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

describe("phraseBriefing — a good answer", () => {
  it("uses the model's phrasing when it stays inside the facts it was given", async () => {
    const good = { headline: "Fall Mixer needs your attention", line: "Confirm headcount is due today." };
    const { notice, source } = await phraseBriefing(BRIEFING, EVENT_TITLE, {
      now: NOW,
      eventDate: EVENT_DATE,
      fetchImpl: modelSays(JSON.stringify(good)),
    });
    expect(source).toBe("model");
    expect(notice).toEqual({ title: good.headline, body: good.line });
  });
});

describe("phraseBriefing — grounding", () => {
  it("discards a number the model invented and falls back to digestNotice", async () => {
    const invented = { headline: "Fall Mixer needs you", line: "8 vendors are still waiting on you." };
    const { notice, source } = await phraseBriefing(BRIEFING, EVENT_TITLE, {
      now: NOW,
      eventDate: EVENT_DATE,
      fetchImpl: modelSays(JSON.stringify(invented)),
    });
    expect(source).toBe("fallback");
    expect(notice).toEqual(digestNotice(BRIEFING, EVENT_TITLE));
  });
});

describe("phraseBriefing — a bad answer", () => {
  it("falls back on prose that isn't JSON", async () => {
    const { source } = await phraseBriefing(BRIEFING, EVENT_TITLE, {
      now: NOW,
      eventDate: EVENT_DATE,
      fetchImpl: modelSays("Sure, here is your update for the day."),
    });
    expect(source).toBe("fallback");
  });

  it("falls back on a server error", async () => {
    const { source } = await phraseBriefing(BRIEFING, EVENT_TITLE, {
      now: NOW,
      eventDate: EVENT_DATE,
      fetchImpl: replyWith({ error: "down" }, 500),
    });
    expect(source).toBe("fallback");
  });

  it("falls back when rate limited", async () => {
    const { source } = await phraseBriefing(BRIEFING, EVENT_TITLE, {
      now: NOW,
      eventDate: EVENT_DATE,
      fetchImpl: replyWith({ error: "slow down" }, 429),
    });
    expect(source).toBe("fallback");
  });
});

describe("phraseBriefing — being switched off", () => {
  it("falls back without ever calling fetch when there is no key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const spy = vi.fn(modelSays(JSON.stringify({ headline: "x", line: "y" })));
    const { source } = await phraseBriefing(BRIEFING, EVENT_TITLE, { now: NOW, eventDate: EVENT_DATE, fetchImpl: spy });
    expect(source).toBe("fallback");
    expect(spy).not.toHaveBeenCalled();
  });
});
