import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("@/lib/actions/tasks", () => ({ toggleTaskAction: vi.fn() }));
vi.mock("@/lib/actions/brief", () => ({ setEventTypeAction: vi.fn() }));

import { BRIEF_MIN_CONFIDENCE, classifyKind, stateForBrief, typeCheckFrom } from "@/lib/brief-classify";
import { briefingFor } from "@/lib/agent/briefing";
import { AgentPanel } from "@/components/agent-panel";

const JEV_ON = { TYPESAFE_API_KEY: "ts-test-key", JEV_DECISIONS: "brief" };

/** A Jev that picks `choice` with `confidence`, and remembers what it was sent. */
function jevPicks(choice: string, confidence: number, sent: unknown[] = []): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)).state);
    return new Response(
      JSON.stringify({
        model: "jev-1.13",
        answers: { eventType: { type: "choice", choice, confidence, probabilities: {} } },
        usage: { input_tokens: 20, output_tokens: 1 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

const logged = () => mocks.record.mock.calls.map(([, line]) => JSON.parse(line.body));

beforeEach(() => {
  mocks.record.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("classifyKind", () => {
  it("lets the keyword table answer first, without asking Jev", async () => {
    const sent: unknown[] = [];
    const result = await classifyKind("evt-1", "Pitch night", { env: JEV_ON, fetch: jevPicks("MIXER", 0.99, sent) });
    expect(result).toEqual({ type: "PITCH_NIGHT", source: "keywords" });
    expect(sent).toHaveLength(0);
  });

  it("plans from Jev's pick when it's confident, and logs it", async () => {
    const sent: unknown[] = [];
    const result = await classifyKind("evt-1", "crawfish boil", {
      env: JEV_ON,
      fetch: jevPicks("DINNER_PARTY", BRIEF_MIN_CONFIDENCE + 0.1, sent),
    });
    expect(result).toEqual({ type: "DINNER_PARTY", source: "jev" });
    expect(sent).toEqual([{ hostWordsForTheEvent: "crawfish boil" }]);
    expect(logged()[0]).toMatchObject({
      point: "brief",
      subject: "crawfish boil",
      verdict: "confident",
      fellBack: false,
      answers: { eventType: { answer: "DINNER_PARTY" } },
    });
  });

  it("keeps today's fallback when Jev is unsure, and logs its guess for the briefing", async () => {
    const result = await classifyKind("evt-1", "crawfish boil", {
      env: JEV_ON,
      fetch: jevPicks("DINNER_PARTY", BRIEF_MIN_CONFIDENCE - 0.2),
    });
    expect(result).toEqual({ type: "MIXER", source: "fallback" });
    expect(logged()[0]).toMatchObject({ verdict: "unsure", fellBack: true, answers: { eventType: { answer: "DINNER_PARTY" } } });
  });

  it("does exactly what it did before when the point is off", async () => {
    const sent: unknown[] = [];
    const result = await classifyKind("evt-1", "crawfish boil", { env: {}, fetch: jevPicks("DINNER_PARTY", 0.99, sent) });
    expect(result).toEqual({ type: "MIXER", source: "fallback" });
    expect(sent).toHaveLength(0);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("falls back and logs it when Jev is on but doesn't answer", async () => {
    const down = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    expect(await classifyKind("evt-1", "crawfish boil", { env: JEV_ON, fetch: down })).toEqual({
      type: "MIXER",
      source: "fallback",
    });
    expect(logged()[0]).toMatchObject({ point: "brief", verdict: "no answer", fellBack: true });
  });

  it("sends only the host's words for the kind of night", () => {
    expect(stateForBrief("  crawfish boil ")).toEqual({ hostWordsForTheEvent: "crawfish boil" });
  });
});

describe("asking the host about the type", () => {
  const unsure = { verdict: "unsure", subject: "crawfish boil", answers: { eventType: { answer: "DINNER_PARTY" } } };

  it("asks only while the event is still on the fallback and the words haven't changed", () => {
    expect(typeCheckFrom({ type: "MIXER", kind: "crawfish boil" }, unsure)).toBe("DINNER_PARTY");
    expect(typeCheckFrom({ type: "DINNER_PARTY", kind: "crawfish boil" }, unsure)).toBeNull();
    expect(typeCheckFrom({ type: "MIXER", kind: "oyster night" }, unsure)).toBeNull();
    expect(typeCheckFrom({ type: "MIXER", kind: "crawfish boil" }, { ...unsure, verdict: "confident" })).toBeNull();
    expect(typeCheckFrom({ type: "MIXER", kind: "crawfish boil" }, null)).toBeNull();
  });

  it("doesn't ask whether a mixer is a mixer", () => {
    const guess = { ...unsure, answers: { eventType: { answer: "MIXER" } } };
    expect(typeCheckFrom({ type: "MIXER", kind: "crawfish boil" }, guess)).toBeNull();
  });

  it("shows a card with the one press that settles it", () => {
    const briefing = briefingFor(
      { id: "e1", title: "Crawfish boil", date: null },
      { tasks: [], inquiries: [], collaborators: [{ id: "v", kind: "VENUE", name: "Hall", email: null, status: "CONFIRMED", sentAt: null }], typeCheck: "DINNER_PARTY", now: new Date("2026-09-24T12:00:00Z") },
    );
    expect(briefing.items).toHaveLength(1);
    expect(briefing.items[0]).toMatchObject({
      kind: "type_check",
      title: "Is this a dinner party?",
      action: { type: "set_type", eventType: "DINNER_PARTY", label: "Plan it as a dinner party" },
    });

    const html = renderToStaticMarkup(
      createElement(AgentPanel, { briefing, eventId: "e1", canSend: true, venueSearchEnabled: true, firstName: "Leo" }),
    );
    expect(html).toContain("Is this a dinner party?");
    expect(html).toContain('name="type" value="DINNER_PARTY"');
    expect(html).toContain("Plan it as a dinner party");
  });
});
