import { z } from "zod";
import { askOr } from "@/lib/ai/client";
import { daysUntil, describeCountdown } from "@/lib/plan";
import { digestNotice, numbersAreGrounded, type Briefing } from "@/lib/agent/briefing";

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
 */

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
  opts: { fetchImpl?: typeof fetch; eventDate?: Date | null; now?: Date } = {},
): Promise<{ notice: { title: string; body: string }; source: "model" | "fallback" }> {
  const now = opts.now ?? new Date();
  const daysUntilEvent = daysUntil(opts.eventDate ?? null, now);
  // askOr's fallback must answer in the model's shape (voiceSchema), not
  // Notice's — digestNotice's own {title, body} is unpacked into it and
  // repacked below so both paths convert through exactly one place.
  const fallback = () => {
    const notice = digestNotice(b, eventTitle);
    return { headline: notice.title, line: notice.body };
  };

  const { value, source } = await askOr(
    {
      system: SYSTEM,
      prompt: promptFor(b, eventTitle, daysUntilEvent),
      schema: voiceSchema,
      timeoutMs: 6000,
      maxTokens: 200,
      fetchImpl: opts.fetchImpl,
    },
    fallback,
  );

  if (source === "model") {
    const allowed = [b.counts.now, b.counts.soon, ...(daysUntilEvent === null ? [] : [daysUntilEvent])];
    if (numbersAreGrounded(`${value.headline} ${value.line}`, allowed)) {
      return { notice: { title: value.headline, body: value.line }, source: "model" };
    }
    // The model invented a number — discard its answer entirely and use the
    // deterministic one, not the untrustworthy value we just rejected.
    const discarded = fallback();
    return { notice: { title: discarded.headline, body: discarded.line }, source: "fallback" };
  }
  return { notice: { title: value.headline, body: value.line }, source: "fallback" };
}
