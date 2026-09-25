import { choice } from "@typesafe-ai/sdk";
import type { EventType } from "@/generated/prisma/enums";
import { ALL_EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import { eventTypeForKind, FALLBACK_TYPE } from "@/lib/brief";
import { decide, jevEnabled, logDecision, picked, summarize, type DecideOptions } from "@/lib/ai/decide";

/**
 * Which template a brief plans from, when the host's own words for the night
 * don't name one.
 *
 * The keyword table (lib/brief.ts) goes first and wins whenever it matches:
 * it's instant, and a host who wrote "dinner party" meant it. Only when it
 * finds nothing, which today silently becomes a mixer, does Jev pick from the
 * templates. A confident pick is saved as the event's type; an unsure one
 * keeps the mixer and leaves a decision row the briefing turns into
 * "Is this a …?", with a button that sets it (see typeCheckFrom).
 */

/** How sure Jev must be to plan the night from its pick without asking. */
export const BRIEF_MIN_CONFIDENCE = 0.7;

export const BRIEF_QUESTIONS = {
  eventType: choice(
    "Which kind of event is the host describing? Pick the one whose planning fits how this night will run.",
    Object.fromEntries(
      ALL_EVENT_TYPES.map((type) => [type, `${EVENT_TYPE_LABEL[type]}: ${EVENT_TEMPLATES[type].blurb}`]),
    ),
  ),
};

/** Only the host's words for the kind of night: no title (it can hold a
 *  person's name), no budget, no guests. */
export function stateForBrief(kind: string) {
  return { hostWordsForTheEvent: kind.trim() };
}

export type KindClassification = {
  type: EventType;
  source: "keywords" | "jev" | "fallback";
};

export async function classifyKind(
  eventId: string,
  kind: string,
  opts: DecideOptions = {},
): Promise<KindClassification> {
  const keyword = eventTypeForKind(kind);
  if (keyword) return { type: keyword, source: "keywords" };
  if (!kind.trim()) return { type: FALLBACK_TYPE, source: "fallback" };

  const decision = await decide("brief", stateForBrief(kind), BRIEF_QUESTIONS, opts);
  if (!decision) {
    if (jevEnabled("brief", opts.env)) {
      await logDecision(eventId, {
        point: "brief",
        subject: kind.trim(),
        answers: {},
        verdict: "no answer",
        model: null,
        fellBack: true,
      });
    }
    return { type: FALLBACK_TYPE, source: "fallback" };
  }

  const pick = picked<EventType>(decision.answers.eventType, BRIEF_MIN_CONFIDENCE);
  await logDecision(eventId, {
    point: "brief",
    subject: kind.trim(),
    answers: summarize(decision.answers),
    verdict: pick === "unsure" ? "unsure" : "confident",
    model: decision.model,
    fellBack: pick === "unsure",
    ms: decision.ms,
    inputTokens: decision.inputTokens,
  });
  return pick === "unsure" ? { type: FALLBACK_TYPE, source: "fallback" } : { type: pick, source: "jev" };
}

/**
 * The type worth asking the host about, from the latest `brief` decision: only
 * while that decision was unsure about these exact words, the event is still
 * on the fallback type, and Jev's best guess is something else. Null otherwise.
 */
export function typeCheckFrom(
  event: { type: EventType; kind: string | null },
  latest: { verdict: string; subject?: string; answers: Record<string, { answer?: string | number }> } | null,
): EventType | null {
  if (!latest || latest.verdict !== "unsure") return null;
  if (event.type !== FALLBACK_TYPE || !event.kind || latest.subject !== event.kind.trim()) return null;
  const guess = latest.answers.eventType?.answer;
  if (typeof guess !== "string" || !ALL_EVENT_TYPES.includes(guess as EventType)) return null;
  return guess === FALLBACK_TYPE ? null : (guess as EventType);
}
