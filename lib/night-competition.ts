import { noul, score } from "@typesafe-ai/sdk";
import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { CLASH_WINDOW_HOURS, clashWindow } from "@/lib/campus/conflicts";
import { sanitizeHostWords } from "@/lib/ai/sanitize-host-words";
import {
  decide,
  jevEnabled,
  loadDecisions,
  logDecision,
  scored,
  summarize,
  yesNo,
  type DecideOptions,
  type DecisionLog,
  type NoulBand,
} from "@/lib/ai/decide";

/**
 * Is anything else in town that night actually competition?
 *
 * Code finds what's on: other hosts' public, published Hosty nights in the
 * same city within a few hours of this one. That's the only city calendar
 * Hosty has, so it's thin until there are more hosts; sameNightCityEvents is
 * the one place an outside feed would plug in. Jev then judges each one: does
 * it draw the same people, and how much would it pull. Code decides what the
 * host sees, and the briefing's words cite only those saved answers.
 *
 * Only PUBLIC + published nights are ever read, the same rule Discover used,
 * so an unlisted or private night never reaches another host or Jev. No host
 * or owner names are sent, only titles and kinds.
 */

export const COMPETING_LIMIT = 6;
export const SAME_CROWD_BAND: NoulBand = { yesAt: 0.7, noAt: 0.3 };
export const PULL_MIN_CONFIDENCE = 0.6;
/** From "a noticeable share" up: worth a line in the briefing. */
export const PULL_SURFACE_AT = 2;
/** How long a judgment stands before the next run's replaces it. */
const DECISION_FRESH_DAYS = 14;

const PULL_LEVELS = [
  "None: it draws a different crowd",
  "A few of the host's guests might pick it instead",
  "A noticeable share of the host's guests might go there instead",
  "Most of the host's crowd would be torn between the two",
] as const;

export const COMPETING_QUESTIONS = {
  sameCrowd: noul("The other event is likely to draw the same people as the host's event.", {
    true: "Yes if both would appeal to the same kind of guest: a similar kind of night, a similar crowd, similar interests.",
    false: "No if they'd appeal to different people, for example a formal fundraiser and a casual study break.",
  }),
  pull: score("How much would the other event pull attendance away from the host's event?", PULL_LEVELS),
};

export type NightEvent = { id: string; title: string; type: EventType; kind: string | null; date: Date };

type HostNight = {
  id: string;
  city: string;
  date: Date | null;
  ownerId: string | null;
  seriesId?: string | null;
  type: EventType;
  kind: string | null;
};

/** Other hosts' public nights in the same city, within the clash window. */
export async function sameNightCityEvents(event: HostNight): Promise<NightEvent[]> {
  if (!event.date || !event.city.trim()) return [];
  const { from, to } = clashWindow(event.date, CLASH_WINDOW_HOURS);
  return db.event.findMany({
    where: {
      id: { not: event.id },
      city: event.city,
      published: true,
      visibility: "PUBLIC",
      status: { not: "CANCELLED" },
      date: { gte: from, lte: to },
      // Not the host's own nights, and not another night of the same series.
      ...(event.ownerId ? { NOT: { ownerId: event.ownerId } } : {}),
      ...(event.seriesId ? { OR: [{ seriesId: null }, { seriesId: { not: event.seriesId } }] } : {}),
    },
    select: { id: true, title: true, type: true, kind: true, date: true },
    orderBy: { date: "asc" },
    take: COMPETING_LIMIT,
  }) as Promise<NightEvent[]>;
}

/** "starts 1 hour after yours": the gap, worked out by code, in words. */
export function timingPhrase(host: Date, other: Date): string {
  const minutes = Math.round((other.getTime() - host.getTime()) / 60_000);
  if (Math.abs(minutes) < 30) return "starts at about the same time as yours";
  const hours = Math.round(Math.abs(minutes) / 60);
  const span = hours <= 1 ? "about an hour" : `about ${hours} hours`;
  return minutes > 0 ? `starts ${span} after yours` : `starts ${span} before yours`;
}

export function stateForCompeting(host: HostNight, other: NightEvent) {
  return {
    hostEvent: { kind: EVENT_TYPE_LABEL[host.type], hostWords: sanitizeHostWords(host.kind) },
    otherEvent: { title: other.title, kind: EVENT_TYPE_LABEL[other.type], hostWords: sanitizeHostWords(other.kind) },
    timing: timingPhrase(host.date!, other.date),
  };
}

/**
 * Judges each same-night event and logs the answers. Run by the agent after
 * its steps; never throws, and does nothing with the point off.
 */
export async function judgeNightCompetition(
  event: HostNight,
  opts: DecideOptions = {},
): Promise<number> {
  if (!jevEnabled("competing", opts.env) || !event.date) return 0;
  try {
    const others = await sameNightCityEvents(event);
    const decisions = await Promise.all(
      others.map((other) => decide("competing", stateForCompeting(event, other), COMPETING_QUESTIONS, opts)),
    );

    let competing = 0;
    await Promise.all(
      others.map((other, i) => {
        const decision = decisions[i];
        if (!decision) {
          return logDecision(event.id, {
            point: "competing",
            subject: other.title,
            subjectId: other.id,
            answers: {},
            verdict: "no answer",
            model: null,
            fellBack: true,
          });
        }
        const sameCrowd = yesNo(decision.answers.sameCrowd, SAME_CROWD_BAND);
        const pull = scored(decision.answers.pull, PULL_MIN_CONFIDENCE);
        const competes = sameCrowd === "yes" && pull !== "unsure" && pull >= PULL_SURFACE_AT;
        if (competes) competing += 1;
        return logDecision(event.id, {
          point: "competing",
          subject: other.title,
          subjectId: other.id,
          answers: summarize(decision.answers),
          verdict: competes ? "competes" : sameCrowd === "unsure" || pull === "unsure" ? "unsure" : "different crowd",
          model: decision.model,
          fellBack: false,
          ms: decision.ms,
          inputTokens: decision.inputTokens,
        });
      }),
    );
    return competing;
  } catch (error) {
    console.error("[jev] competing: skipped", error instanceof Error ? error.message : error);
    return 0;
  }
}

export type Competitor = { id: string; title: string; pull: number };

/**
 * What the briefing surfaces: nights Jev judged as competition, still on the
 * same night now, newest judgment per night. Code re-checks the calendar so a
 * night that moved or was cancelled since drops out.
 */
export function competitorsFrom(
  decisions: Array<DecisionLog & { at: Date }>,
  stillOn: NightEvent[],
): Competitor[] {
  const current = new Map(stillOn.map((night) => [night.id, night]));
  const seen = new Set<string>();
  const out: Competitor[] = [];
  for (const decision of decisions) {
    if (!decision.subjectId || seen.has(decision.subjectId)) continue;
    seen.add(decision.subjectId);
    const night = current.get(decision.subjectId);
    const pull = decision.answers.pull?.answer;
    if (!night || decision.verdict !== "competes" || typeof pull !== "number") continue;
    out.push({ id: night.id, title: night.title, pull });
  }
  return out;
}

export async function loadCompetitors(
  event: HostNight,
  now = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<Competitor[]> {
  // With the point off, the briefing doesn't pay for the lookup.
  if (!event.date || !jevEnabled("competing", env)) return [];
  const since = new Date(now.getTime() - DECISION_FRESH_DAYS * 86_400_000);
  const decisions = await loadDecisions(event.id, "competing", { since, take: 30 });
  if (!decisions.some((d) => d.verdict === "competes")) return [];
  return competitorsFrom(decisions, await sameNightCityEvents(event));
}
