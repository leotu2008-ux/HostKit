import {
  TypeSafeClient,
  type ChoiceResponse,
  type EntryType,
  type NoulResponse,
  type Question,
  type Questions,
  type ScoreResponse,
  type SystemOneResult,
} from "@typesafe-ai/sdk";
import { db } from "@/lib/db";
import { record } from "@/lib/activity";

/**
 * The decision layer: where Hosty asks Jev (TypeSafe's System One model) a
 * typed question instead of asking Claude to decide something in prose.
 *
 * The split this file exists to hold: **Claude writes, Jev decides, code does
 * the math.** Jev answers yes/no (`noul`), picks one of named options
 * (`choice`) or rates against an ordered rubric (`score`), each with a
 * calibrated probability, in a few hundred milliseconds. It is never asked
 * for text, a number to use, a date, a budget split, or who may do what.
 *
 * The same four rules as lib/ai/client.ts, because every caller leans on them.
 *
 * **Absence is normal.** A point that isn't in `JEV_DECISIONS`, a server with
 * no `AI_GATEWAY_API_KEY`, an error, a slow answer or a malformed one all come
 * back as `null`, and every caller already has today's behaviour to fall back
 * on. Nothing here throws into a run.
 *
 * **Answers are checked, not trusted.** Every answer is matched against the
 * question it answers — its type, a label that was actually offered, a
 * probability between 0 and 1 — before anyone reads it.
 *
 * **Unsure is its own answer.** Each point names its own thresholds, and an
 * answer below them takes that point's unsure path, which is never the
 * confident one. Thresholds don't carry across primitive types: a noul
 * probability and a choice confidence aren't on the same scale.
 *
 * **It never sources facts.** The state a point sends is built from named
 * fields by that point's own builder — never guest names, emails or phones,
 * the host's contact details, or the budget.
 */

/**
 * Every call goes through Vercel AI Gateway's TypeSafe-compatible API, never
 * to TypeSafe directly: one key (`AI_GATEWAY_API_KEY`), billing and logs
 * alongside the other models, and zero data retention on every request.
 */
export const JEV_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/typesafe";
export const JEV_MODEL = "typesafe-ai/jev";

/** The gateway extension that routes a request only to providers with a zero
 *  data retention agreement; with none available, the request fails (and the
 *  point falls back) rather than going somewhere that keeps the data. */
export const ZERO_DATA_RETENTION = { gateway: { zeroDataRetention: true } } as const;

export const DECISION_POINTS = ["guardrail", "brief", "venue", "competing"] as const;
export type DecisionPoint = (typeof DECISION_POINTS)[number];

/** Past this, the caller takes its fallback. Jev answers in 100–500ms, so
 *  3s is a stall, not a slow answer. Override with JEV_TIMEOUT_MS. */
export const DEFAULT_JEV_TIMEOUT_MS = 3_000;

/** How many Jev calls one server process lets run at once, shared by every
 *  caller, so a venue list and a busy night can't flood the API together. */
export const JEV_MAX_IN_FLIGHT = 8;

type Env = Record<string, string | undefined>;

/** The points switched on by `JEV_DECISIONS=guardrail,brief,…`. Empty or
 *  unset means all off; a name this file doesn't know is ignored. */
export function jevPoints(env: Env = process.env): Set<DecisionPoint> {
  const named = (env.JEV_DECISIONS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return new Set(DECISION_POINTS.filter((point) => named.includes(point)));
}

export function jevEnabled(point: DecisionPoint, env: Env = process.env): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY?.trim()) && jevPoints(env).has(point);
}

export function jevTimeoutMs(env: Env = process.env): number {
  const parsed = Number(env.JEV_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_JEV_TIMEOUT_MS;
}

// ---------------------------------------------------------------------------
// The limiter
// ---------------------------------------------------------------------------

let inFlight = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (inFlight < JEV_MAX_IN_FLIGHT) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiting.push(() => {
      inFlight += 1;
      resolve();
    });
  });
}

function release(): void {
  inFlight -= 1;
  waiting.shift()?.();
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

export type Decision<Q extends Questions> = {
  answers: SystemOneResult<Q>["answers"];
  /** The model that answered, from the response — logged with every decision. */
  model: string;
  inputTokens: number;
  ms: number;
};

export type DecideOptions = {
  /** Time the caller can spare, when it has less than the timeout to give. */
  budgetMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  env?: Env;
};

let cached: { key: string; client: TypeSafeClient } | null = null;

/** A TypeSafe client pointed at the gateway. Exported for the eval script. */
export function gatewayClient(
  apiKey: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): TypeSafeClient {
  return new TypeSafeClient({
    apiKey,
    baseURL: JEV_GATEWAY_BASE_URL,
    defaultModel: JEV_MODEL,
    // One attempt: a retry would outlast the timeout the caller is counting on.
    retry: { maxRetries: 0 },
    timeout: opts.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS,
    // The SDK logs request bodies at debug; state never goes to the logs.
    logLevel: "off",
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
}

/** The request body: the model, the state and questions, and zero data
 *  retention. The SDK forwards fields it doesn't know, which is how the
 *  gateway's `providerOptions` reaches it. */
export function gatewayRequest<const Q extends Questions>(state: EntryType, questions: Q) {
  return { model: JEV_MODEL, state, questions, ...{ providerOptions: ZERO_DATA_RETENTION } };
}

function clientFor(env: Env, fetchImpl?: typeof fetch): TypeSafeClient {
  const apiKey = env.AI_GATEWAY_API_KEY?.trim() ?? "";
  const timeoutMs = jevTimeoutMs(env);
  if (fetchImpl) return gatewayClient(apiKey, { fetch: fetchImpl, timeoutMs });
  const key = `${apiKey}|${timeoutMs}`;
  if (cached?.key !== key) cached = { key, client: gatewayClient(apiKey, { timeoutMs }) };
  return cached.client;
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Whether an answer is the kind of answer its question asked for. */
function answers(question: Question, answer: unknown): boolean {
  if (!answer || typeof answer !== "object") return false;
  const a = answer as Record<string, unknown>;
  if (a.type !== question.type) return false;
  switch (question.type) {
    case "noul":
      return isProbability(a.noul);
    case "choice":
      return (
        isProbability(a.confidence) &&
        typeof a.choice === "string" &&
        Object.hasOwn(question.criteria, a.choice)
      );
    case "score":
      return (
        isProbability(a.confidence) &&
        typeof a.score === "number" &&
        a.score >= 0 &&
        a.score <= question.criteria.length - 1
      );
  }
}

/** Every question answered, each in its own terms. */
export function saneAnswers(questions: Questions, answerMap: unknown): boolean {
  if (!answerMap || typeof answerMap !== "object") return false;
  const byId = answerMap as Record<string, unknown>;
  return Object.entries(questions).every(([id, question]) => answers(question, byId[id]));
}

/**
 * Asks Jev the questions about `state`, or returns null — see the rules at
 * the top of this file. Never throws.
 */
export async function decide<const Q extends Questions>(
  point: DecisionPoint,
  state: EntryType,
  questions: Q,
  opts: DecideOptions = {},
): Promise<Decision<Q> | null> {
  const env = opts.env ?? process.env;
  if (!jevEnabled(point, env)) return null;

  const started = Date.now();
  const timeoutMs = Math.min(jevTimeoutMs(env), opts.budgetMs ?? Infinity);
  if (!(timeoutMs > 0)) return null;

  await acquire();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Time spent queued behind other calls counts: the caller's clock is
    // running either way.
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) return null;
    timer = setTimeout(() => controller.abort(), remaining);

    const result = await clientFor(env, opts.fetch).systemOne(
      gatewayRequest(state, questions),
      { signal: controller.signal, timeout: remaining, retry: { maxRetries: 0 } },
    );

    if (!saneAnswers(questions, result.answers)) {
      console.error(`[jev] ${point}: an answer didn't match its question; falling back`);
      return null;
    }
    return {
      answers: result.answers,
      model: result.model,
      inputTokens: result.usage?.input_tokens ?? 0,
      ms: Date.now() - started,
    };
  } catch (error) {
    console.error(`[jev] ${point}: falling back`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
    release();
  }
}

// ---------------------------------------------------------------------------
// Verdicts: an answer read against a point's own thresholds
// ---------------------------------------------------------------------------

/** A noul carries a probability of yes and no confidence of its own, so a
 *  point says where yes starts and where no ends; between them is unsure. */
export type NoulBand = { yesAt: number; noAt: number };

export function yesNo(answer: NoulResponse, band: NoulBand): "yes" | "no" | "unsure" {
  if (answer.noul >= band.yesAt) return "yes";
  if (answer.noul <= band.noAt) return "no";
  return "unsure";
}

export function picked<L extends string>(answer: ChoiceResponse, minConfidence: number): L | "unsure" {
  return answer.confidence >= minConfidence ? (answer.choice as L) : "unsure";
}

export function scored(answer: ScoreResponse, minConfidence: number): number | "unsure" {
  return answer.confidence >= minConfidence ? answer.score : "unsure";
}

// ---------------------------------------------------------------------------
// The decision log
// ---------------------------------------------------------------------------

type AnswerSummary = { answer?: string | number; p?: number; confidence?: number };

export type DecisionLog = {
  point: DecisionPoint;
  /** What was judged, when a point judges several things (a venue's name). */
  subject?: string;
  /** The judged thing's id, when it has one (another event's id). */
  subjectId?: string;
  answers: Record<string, AnswerSummary>;
  /** What the point did with the answers, in its own words. */
  verdict: string;
  model: string | null;
  /** True when the point took today's path instead of Jev's answer. */
  fellBack: boolean;
  reason?: string;
  ms?: number;
  inputTokens?: number;
};

/** The loggable shape of an answer map: probabilities and picks, no state. */
export function summarize(answerMap: Record<string, NoulResponse | ChoiceResponse | ScoreResponse>) {
  const out: Record<string, AnswerSummary> = {};
  for (const [id, a] of Object.entries(answerMap)) {
    if (a.type === "noul") out[id] = { p: a.noul };
    else if (a.type === "choice") out[id] = { answer: a.choice, confidence: a.confidence };
    else out[id] = { answer: a.score, confidence: a.confidence };
  }
  return out;
}

/** A plain activity row, quiet in every feed (loadActivity leaves `decision`
 *  rows out), that says what was decided and on what — the record hosty-voice
 *  and the briefing can phrase, and the data for tuning thresholds. */
export async function logDecision(eventId: string, entry: DecisionLog): Promise<void> {
  await record(eventId, {
    actor: "system",
    kind: "decision",
    title: `${entry.point}: ${entry.verdict}`,
    body: JSON.stringify(entry),
  });
}

export function readDecision(body: string | null): DecisionLog | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Partial<DecisionLog>;
    if (!parsed || !DECISION_POINTS.includes(parsed.point as DecisionPoint)) return null;
    if (typeof parsed.verdict !== "string") return null;
    return parsed as DecisionLog;
  } catch {
    return null;
  }
}

/** The newest decisions one point made for an event, newest first. */
export async function loadDecisions(
  eventId: string,
  point: DecisionPoint,
  opts: { since?: Date; take?: number } = {},
): Promise<Array<DecisionLog & { at: Date }>> {
  const rows = await db.activity.findMany({
    where: {
      eventId,
      kind: "decision",
      title: { startsWith: `${point}:` },
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 20,
    select: { body: true, createdAt: true },
  });
  return rows.flatMap((row) => {
    const log = readDecision(row.body);
    return log ? [{ ...log, at: row.createdAt }] : [];
  });
}
