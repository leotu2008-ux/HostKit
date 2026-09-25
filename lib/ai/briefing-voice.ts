import { z } from "zod";
import { askOr } from "@/lib/ai/client";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { digestNotice, numbersAreGrounded, type Briefing } from "@/lib/agent/briefing";
import { checkDraft } from "@/lib/ai/guardrail";

/**
 * AI touchpoint #2: turns an already-computed Briefing into one short,
 * human line. Cron-only (app/api/cron/agent-briefing) — never called on a
 * page render, so a slow or absent model never holds up a page.
 *
 * The model may only phrase facts it is handed in the prompt; it may not
 * introduce one. After the schema passes, numbersAreGrounded re-checks that
 * every digit the model wrote back was actually given to it — a model that
 * writes "8 vendors" out of nowhere is treated exactly like a model that
 * returned bad JSON, and digestNotice's deterministic line is used instead.
 *
 * Then the guardrail (lib/ai/guardrail.ts) reads the line for the two things
 * a digit check can't see: a hint at the budget, and a value written in words.
 * A line it fails is written once more with the reason attached; failing
 * again, the deterministic line goes out instead. Unsure lets the line through
 * and the decision log keeps the flag.
 */

/** The model's own answer time, and what a phrasing needs left to be worth
 *  starting: one answer plus a guardrail check. */
const PHRASE_TIMEOUT_MS = 6_000;
const GUARDRAIL_TIMEOUT_MS = 3_000;

const voiceSchema = z.object({
  headline: z.string().min(4).max(90),
  line: z.string().min(4).max(160),
});

const SYSTEM = `You write one short line summarizing an event host's daily digest, using only facts you are handed.
Rules:
- Use only the facts in the prompt below. Never add a fact, a number, a name, or a date that was not given to you.
- No exclamation marks. No emoji.
- Reply with JSON only, matching exactly: {"headline": string, "line": string}. Nothing else — no prose, no markdown fence.`;

function promptFor(b: Briefing, eventTitle: string, daysUntilEvent: number | null): string {
  const items =
    b.items.map((item) => `- [${item.kind}] ${item.title}: ${item.detail}`).join("\n") || "(nothing listed)";
  return [
    `Event: ${eventTitle}`,
    `Event is: ${describeCountdown(daysUntilEvent)}`,
    `Things that need the host right now: ${b.counts.now}`,
    `Things coming up soon: ${b.counts.soon}`,
    `Items:`,
    items,
  ].join("\n");
}

export async function phraseBriefing(
  b: Briefing,
  eventTitle: string,
  opts: {
    fetchImpl?: typeof fetch;
    eventDate?: Date | null;
    now?: Date;
    /** Wall-clock time (ms) by which this must be done; the digest shares one
     *  function's time limit across many events. */
    deadline?: number;
    /** Injectable for tests: the guardrail's fetch and environment. */
    jev?: { fetch?: typeof fetch; env?: Record<string, string | undefined> };
  } = {},
): Promise<{ notice: { title: string; body: string }; source: "model" | "fallback" }> {
  const now = opts.now ?? new Date();
  const daysUntilEvent = daysUntil(opts.eventDate ?? null, now);
  const left = () => (opts.deadline ?? Infinity) - Date.now();
  // askOr's fallback must answer in the model's shape (voiceSchema); the
  // value is never used, because every non-model answer goes through
  // deterministic() instead.
  const fallback = () => {
    const notice = digestNotice(b, eventTitle);
    return { headline: notice.title, line: notice.body };
  };

  const allowed = [b.counts.now, b.counts.soon, ...(daysUntilEvent === null ? [] : [daysUntilEvent])];
  const countdown = describeCountdown(daysUntilEvent);
  const deterministic = () => {
    const notice = digestNotice(b, eventTitle);
    return { notice: { title: notice.title, body: notice.body }, source: "fallback" as const };
  };

  const write = async (extra?: string) => {
    const timeoutMs = Math.min(PHRASE_TIMEOUT_MS, left());
    if (timeoutMs <= 0) return null;
    const prompt = promptFor(b, eventTitle, daysUntilEvent);
    const { value, source } = await askOr(
      {
        system: SYSTEM,
        prompt: extra ? `${prompt}\n\n${extra}` : prompt,
        schema: voiceSchema,
        timeoutMs,
        maxTokens: 200,
        fetchImpl: opts.fetchImpl,
      },
      fallback,
    );
    // The model invented a number: its answer is discarded entirely, not
    // trusted in part.
    if (source !== "model" || !numbersAreGrounded(`${value.headline} ${value.line}`, allowed)) return null;
    return value;
  };

  const check = (value: { headline: string; line: string }) =>
    checkDraft(`${value.headline}. ${value.line}`, {
      eventId: b.eventId,
      subject: "digest",
      allowedNumbers: allowed,
      // The words the writer was handed may come back ("Due Today").
      allowedPhrases: [countdown, eventTitle, ...b.items.flatMap((item) => [item.title, item.detail])],
      budgetMs: Math.min(GUARDRAIL_TIMEOUT_MS, left()),
      fetch: opts.jev?.fetch,
      env: opts.jev?.env,
    });

  const first = await write();
  if (!first) return deterministic();

  const verdict = await check(first);
  if (!verdict || verdict.verdict !== "fail") {
    return { notice: { title: first.headline, body: first.line }, source: "model" };
  }

  // One more try, told what was wrong; then the line code wrote.
  if (left() < PHRASE_TIMEOUT_MS + GUARDRAIL_TIMEOUT_MS) return deterministic();
  const second = await write(
    `Your last line was rejected because ${verdict.reason}. Write it again without that.`,
  );
  if (!second) return deterministic();
  const recheck = await check(second);
  if (recheck?.verdict === "fail") return deterministic();
  return { notice: { title: second.headline, body: second.line }, source: "model" };
}
