import { z, type ZodType } from "zod";

/**
 * The one place Hosty talks to a model.
 *
 * Deliberately narrow, because the surrounding plan only wants a model where
 * deterministic code genuinely cannot do the job. Turnout is arithmetic. What
 * else is on that night is a query. Neither goes near this file. What does
 * come here is work with no closed-form answer: drafting a plan for the kind
 * of event nobody wrote a template for, reading an event out of a flyer,
 * phrasing a message.
 *
 * Four rules the callers rely on.
 *
 * **Absence is normal.** Without `ANTHROPIC_API_KEY` this is simply off, and
 * every caller must already have something to fall back on. The heuristics in
 * lib/plan.ts and lib/runsheet.ts are not legacy to be deleted; they are the
 * floor under this.
 *
 * **Output is validated, not trusted.** Every call names a schema and the
 * reply is parsed against it. A model that returns something unexpected is
 * treated exactly like a model that is down.
 *
 * **It never has the last word.** Nothing here sends, publishes or spends.
 * Callers turn the result into a draft a person confirms.
 *
 * **It never sources facts.** Numbers go in through the prompt, computed by
 * code that can be checked. The model phrases them; it does not invent them.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/**
 * Sonnet 5 rather than the largest model on purpose: the first caller sits in
 * the event-create flow, where a slow answer is worse than a plainer one, and
 * there is always a heuristic underneath. Override with AI_MODEL where quality
 * matters more than latency.
 */
export const DEFAULT_MODEL = "claude-sonnet-5";

/** Past this, the caller gives up and uses its fallback. */
export const DEFAULT_TIMEOUT_MS = 12_000;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Why a call failed, in the only terms that change what a caller does. */
export type AiFailure =
  | "not-configured"
  | "timeout"
  | "rate-limited"
  | "refused"
  | "bad-output"
  | "unavailable";

export class AiError extends Error {
  constructor(
    readonly failure: AiFailure,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AiError";
  }

  /** Whether trying the same call again could plausibly work. */
  get retryable(): boolean {
    return this.failure === "timeout" || this.failure === "rate-limited" || this.failure === "unavailable";
  }
}

export function classifyStatus(status: number): AiFailure {
  if (status === 401 || status === 403) return "refused";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "unavailable";
  return "bad-output";
}

/**
 * Models like to wrap JSON in prose or a fenced block however firmly you ask
 * them not to. Pulling the outermost object out is cheaper than a retry.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return body;
  return body.slice(start, end + 1);
}

/**
 * Callers tell the model to answer "matching the schema you are given", so
 * give it one: the same schema the reply is validated against, as JSON
 * Schema. Without it the model has to guess key names like `picks`, and a
 * wrong guess is a bad-output fallback. Refinements don't carry over; the
 * safeParse below still enforces them.
 */
function withSchema(system: string, schema: ZodType<unknown>): string {
  return `${system}\n\nJSON Schema for your answer:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

export type AskOptions<T> = {
  /** Standing instructions: who it is and what it must never do. */
  system: string;
  /** The task, carrying every fact the answer may use. */
  prompt: string;
  /** What a valid answer looks like. Anything else is treated as a failure. */
  schema: ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * One round trip, returning a validated object or throwing an AiError.
 *
 * Callers are expected to catch and fall back rather than surface the error —
 * a host who asked for a plan should get the heuristic one, not a stack trace.
 */
export async function ask<T>(options: AskOptions<T>): Promise<T> {
  if (!isAiConfigured()) {
    throw new AiError("not-configured", "No model is configured on this server.");
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": API_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: aiModel(),
        max_tokens: options.maxTokens ?? 2048,
        system: withSchema(options.system, options.schema),
        messages: [{ role: "user", content: options.prompt }],
      }),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new AiError(
      aborted ? "timeout" : "unavailable",
      aborted ? `No answer within ${timeoutMs}ms.` : "Could not reach the model.",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiError(
      classifyStatus(response.status),
      `The model answered ${response.status}.`,
      detail.slice(0, 300),
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { content?: Array<{ type: string; text?: string }> }
    | null;

  const text = payload?.content?.find((part) => part.type === "text")?.text ?? "";
  if (!text.trim()) {
    throw new AiError("bad-output", "The model returned nothing to read.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new AiError("bad-output", "The model did not return JSON.", text.slice(0, 300));
  }

  const checked = options.schema.safeParse(parsed);
  if (!checked.success) {
    throw new AiError(
      "bad-output",
      "The model's answer did not match what was asked for.",
      JSON.stringify(checked.error.issues).slice(0, 300),
    );
  }
  return checked.data;
}

/**
 * The shape every caller should use: try the model, fall back to whatever the
 * code already did, and never let a model failure reach a person.
 *
 * Returns which path produced the answer so a page can say so and so the two
 * can be compared once both are running.
 */
export async function askOr<T>(
  options: AskOptions<T>,
  fallback: () => T,
): Promise<{ value: T; source: "model" | "fallback"; failure?: AiFailure }> {
  try {
    return { value: await ask(options), source: "model" };
  } catch (error) {
    const failure = error instanceof AiError ? error.failure : "unavailable";
    // Absence is expected and not worth logging on every request.
    if (failure !== "not-configured") {
      console.error("[ai] falling back to the heuristic", error);
    }
    return { value: fallback(), source: "fallback", failure };
  }
}
