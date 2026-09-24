import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AiError,
  DEFAULT_MODEL,
  aiModel,
  askOr,
  ask,
  classifyStatus,
  extractJson,
  isAiConfigured,
} from "@/lib/ai/client";

const schema = z.object({ title: z.string(), tasks: z.array(z.string()) });
const good = { title: "Mixer", tasks: ["Book the room"] };

/** A fetch that answers exactly once, the way the Messages API would. */
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

describe("being switched off", () => {
  it("is off without a key, which is a normal state and not an error", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAiConfigured()).toBe(false);
  });

  it("refuses to call when unconfigured, naming why", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(ask({ system: "s", prompt: "p", schema })).rejects.toMatchObject({
      failure: "not-configured",
    });
  });
});

describe("which model", () => {
  it("defaults to the one chosen for latency", () => {
    expect(aiModel()).toBe(DEFAULT_MODEL);
  });

  it("can be overridden where quality matters more", () => {
    process.env.AI_MODEL = "claude-opus-5";
    expect(aiModel()).toBe("claude-opus-5");
  });
});

describe("digging JSON out of an answer", () => {
  it("takes it plain", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("takes it out of a fenced block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("takes it out of surrounding chatter", () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it("keeps a nested object whole", () => {
    expect(extractJson('{"a":{"b":2}}')).toBe('{"a":{"b":2}}');
  });
});

describe("classifying a bad answer", () => {
  it("separates the cases that are worth retrying", () => {
    expect(classifyStatus(401)).toBe("refused");
    expect(classifyStatus(429)).toBe("rate-limited");
    expect(classifyStatus(503)).toBe("unavailable");
    expect(classifyStatus(400)).toBe("bad-output");
    expect(new AiError("rate-limited", "x").retryable).toBe(true);
    expect(new AiError("refused", "x").retryable).toBe(false);
  });
});

describe("a good round trip", () => {
  it("returns the validated object", async () => {
    const out = await ask({
      system: "s",
      prompt: "p",
      schema,
      fetchImpl: modelSays(JSON.stringify(good)),
    });
    expect(out).toEqual(good);
  });

  it("copes with the model wrapping it in a fence", async () => {
    const out = await ask({
      system: "s",
      prompt: "p",
      schema,
      fetchImpl: modelSays("```json\n" + JSON.stringify(good) + "\n```"),
    });
    expect(out).toEqual(good);
  });

  it("tells the model the shape its answer will be held to", async () => {
    let sent: { system: string } | undefined;
    const capture = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return modelSays(JSON.stringify(good))(_url, init);
    }) as unknown as typeof fetch;

    await ask({ system: "Standing rules.", prompt: "p", schema, fetchImpl: capture });

    expect(sent!.system.startsWith("Standing rules.")).toBe(true);
    // Callers' prompts say "matching the schema you are given"; the key names
    // are the part a model can't guess.
    expect(sent!.system).toContain('"title"');
    expect(sent!.system).toContain('"tasks"');
  });
});

describe("output is validated, not trusted", () => {
  it("rejects an answer that does not match the schema", async () => {
    await expect(
      ask({
        system: "s",
        prompt: "p",
        schema,
        fetchImpl: modelSays(JSON.stringify({ title: "Mixer" })), // tasks missing
      }),
    ).rejects.toMatchObject({ failure: "bad-output" });
  });

  it("rejects prose that is not JSON at all", async () => {
    await expect(
      ask({ system: "s", prompt: "p", schema, fetchImpl: modelSays("I'd suggest booking a room.") }),
    ).rejects.toMatchObject({ failure: "bad-output" });
  });

  it("rejects an empty answer", async () => {
    await expect(
      ask({ system: "s", prompt: "p", schema, fetchImpl: replyWith({ content: [] }) }),
    ).rejects.toMatchObject({ failure: "bad-output" });
  });

  it("carries the status through when the call is refused", async () => {
    await expect(
      ask({ system: "s", prompt: "p", schema, fetchImpl: replyWith({ error: "nope" }, 401) }),
    ).rejects.toMatchObject({ failure: "refused" });
  });
});

describe("giving up in time", () => {
  it("aborts rather than holding up the page behind it", async () => {
    // The first caller sits in the event-create flow. A model that never
    // answers must not become a form that never submits.
    const neverAnswers = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as unknown as typeof fetch;

    await expect(
      ask({ system: "s", prompt: "p", schema, fetchImpl: neverAnswers, timeoutMs: 40 }),
    ).rejects.toMatchObject({ failure: "timeout" });
  });

  it("a timeout is worth retrying, unlike a refusal", () => {
    expect(new AiError("timeout", "x").retryable).toBe(true);
  });
});

describe("falling back", () => {
  const fallback = () => ({ title: "Heuristic", tasks: ["From the templates"] });

  it("uses the model when it answers well", async () => {
    const out = await askOr(
      { system: "s", prompt: "p", schema, fetchImpl: modelSays(JSON.stringify(good)) },
      fallback,
    );
    expect(out.source).toBe("model");
    expect(out.value).toEqual(good);
  });

  it("falls back silently when no model is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await askOr({ system: "s", prompt: "p", schema }, fallback);
    expect(out.source).toBe("fallback");
    expect(out.failure).toBe("not-configured");
    // Being switched off is a normal state, not something to log on every request.
    expect(logged).not.toHaveBeenCalled();
  });

  it("falls back when the answer is unusable, and says why", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await askOr(
      { system: "s", prompt: "p", schema, fetchImpl: modelSays("not json") },
      fallback,
    );
    expect(out.source).toBe("fallback");
    expect(out.failure).toBe("bad-output");
    expect(out.value).toEqual(fallback());
  });

  it("never lets a model failure reach the caller as an exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exploding = (async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;
    const out = await askOr({ system: "s", prompt: "p", schema, fetchImpl: exploding }, fallback);
    expect(out.source).toBe("fallback");
  });
});
