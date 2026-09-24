/**
 * Measures one Jev decision point against a hand-labelled fixture.
 *
 *   TYPESAFE_API_KEY=... npx tsx scripts/jev-eval.ts guardrail|brief|venue|competing
 *
 * Real API calls, so manual runs only: never from CI or the test suite. It
 * sends each example in tests/fixtures/jev/<point>.json through the same
 * questions and state builder the app uses (ignoring JEV_DECISIONS, so a
 * point can be measured before it's switched on) and reports, per question:
 *
 * - accuracy at confidence cutoffs 0.6, 0.7, 0.8 and 0.9, and how many
 *   examples clear each cutoff (a noul's confidence here is max(p, 1 − p));
 * - how often the point would fall back with its real thresholds;
 * - p50 and p95 latency, and input tokens.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TypeSafeClient, type EntryType, type Questions } from "@typesafe-ai/sdk";
import { picked, scored, yesNo } from "../lib/ai/decide";
import { BUDGET_BAND, GUARDRAIL_QUESTIONS, VALUES_BAND } from "../lib/ai/guardrail";
import { BRIEF_MIN_CONFIDENCE, BRIEF_QUESTIONS, stateForBrief } from "../lib/brief-classify";
import {
  FIT_MIN_CONFIDENCE,
  PRIVATE_BAND,
  SPACE_MIN_CONFIDENCE,
  VENUE_QUESTIONS,
  stateForVenue,
} from "../lib/ai/venue-judge";
import {
  COMPETING_QUESTIONS,
  PULL_MIN_CONFIDENCE,
  SAME_CROWD_BAND,
} from "../lib/night-competition";
import { EVENT_TYPE_LABEL } from "../lib/catalog";
import type { EventType } from "../generated/prisma/enums";

const CUTOFFS = [0.6, 0.7, 0.8, 0.9];

type Expected = boolean | string | number;
type Example = { id: string; expect: Record<string, Expected> | string } & Record<string, unknown>;
type AnyAnswer = { type: "noul"; noul: number } | { type: "choice"; choice: string; confidence: number } | { type: "score"; score: number; confidence: number };

type Point = {
  questions: Questions;
  state: (example: Example) => EntryType;
  expected: (example: Example) => Record<string, Expected>;
  /** Whether the app would take its unsure or no-answer path for these answers. */
  fallsBack: (answers: Record<string, AnyAnswer>) => boolean;
};

const POINTS: Record<string, Point> = {
  guardrail: {
    questions: GUARDRAIL_QUESTIONS,
    state: (ex) => ({ message: String(ex.message) }),
    expected: (ex) => ex.expect as Record<string, Expected>,
    fallsBack: (a) =>
      yesNo(a.revealsBudget as never, BUDGET_BAND) === "unsure" ||
      yesNo(a.statesValues as never, VALUES_BAND) === "unsure",
  },
  brief: {
    questions: BRIEF_QUESTIONS,
    state: (ex) => stateForBrief(String(ex.kind)),
    expected: (ex) => ({ eventType: ex.expect as string }),
    fallsBack: (a) => picked(a.eventType as never, BRIEF_MIN_CONFIDENCE) === "unsure",
  },
  venue: {
    questions: VENUE_QUESTIONS,
    state: (ex) => {
      const venue = ex.venue as { name: string; category: string | null; address: string };
      const event = ex.event as { type: EventType; guestCount: number };
      return stateForVenue({ id: ex.id, ...venue, phone: null, website: null, lat: 0, lng: 0 }, event);
    },
    expected: (ex) => ex.expect as Record<string, Expected>,
    fallsBack: (a) =>
      yesNo(a.rentsPrivate as never, PRIVATE_BAND) === "unsure" ||
      picked(a.spaceKind as never, SPACE_MIN_CONFIDENCE) === "unsure" ||
      scored(a.fit as never, FIT_MIN_CONFIDENCE) === "unsure",
  },
  competing: {
    questions: COMPETING_QUESTIONS,
    state: (ex) => {
      const host = ex.host as { type: EventType; kind: string | null };
      const other = ex.other as { title: string; type: EventType; kind: string | null };
      // The same shape stateForCompeting builds, with the fixture's own timing.
      return {
        hostEvent: { kind: EVENT_TYPE_LABEL[host.type], hostWords: host.kind ?? "" },
        otherEvent: { title: other.title, kind: EVENT_TYPE_LABEL[other.type], hostWords: other.kind ?? "" },
        timing: String(ex.timing),
      };
    },
    expected: (ex) => ex.expect as Record<string, Expected>,
    fallsBack: (a) =>
      yesNo(a.sameCrowd as never, SAME_CROWD_BAND) === "unsure" ||
      scored(a.pull as never, PULL_MIN_CONFIDENCE) === "unsure",
  },
};

/** An answer's prediction and its confidence, on one scale for reporting. */
function read(answer: AnyAnswer): { prediction: Expected; confidence: number } {
  if (answer.type === "noul") return { prediction: answer.noul >= 0.5, confidence: Math.max(answer.noul, 1 - answer.noul) };
  if (answer.type === "choice") return { prediction: answer.choice, confidence: answer.confidence };
  return { prediction: Math.round(answer.score), confidence: answer.confidence };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const pct = (n: number, d: number) => (d === 0 ? "  –  " : `${((100 * n) / d).toFixed(0).padStart(3)}%`);

async function main() {
  const name = process.argv[2];
  const point = POINTS[name ?? ""];
  if (!point) {
    console.error(`Usage: npx tsx scripts/jev-eval.ts ${Object.keys(POINTS).join("|")}`);
    process.exit(1);
  }
  if (!process.env.TYPESAFE_API_KEY?.trim()) {
    console.error("Set TYPESAFE_API_KEY to run an eval.");
    process.exit(1);
  }

  const fixture = JSON.parse(await readFile(resolve("tests/fixtures/jev", `${name}.json`), "utf8")) as {
    examples: Example[];
  };
  const client = new TypeSafeClient({ retry: { maxRetries: 0 }, timeout: 10_000, logLevel: "off" });

  const latencies: number[] = [];
  const tokens: number[] = [];
  let errors = 0;
  let fallbacks = 0;
  const rows: Array<{ question: string; correct: boolean; confidence: number }> = [];

  for (const example of fixture.examples) {
    const started = Date.now();
    try {
      const result = await client.systemOne({ state: point.state(example), questions: point.questions });
      latencies.push(Date.now() - started);
      tokens.push(result.usage.input_tokens);
      const answers = result.answers as unknown as Record<string, AnyAnswer>;
      if (point.fallsBack(answers)) fallbacks += 1;
      const expected = point.expected(example);
      for (const [question, want] of Object.entries(expected)) {
        const { prediction, confidence } = read(answers[question]);
        rows.push({ question, correct: prediction === want, confidence });
        if (prediction !== want) console.log(`  miss ${example.id} ${question}: got ${String(prediction)}, want ${String(want)} (${confidence.toFixed(2)})`);
      }
    } catch (error) {
      errors += 1;
      console.log(`  error ${example.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const n = fixture.examples.length;
  console.log(`\n${name}: ${n} examples, ${errors} errors`);
  for (const question of Object.keys(point.questions)) {
    const mine = rows.filter((row) => row.question === question);
    if (mine.length === 0) continue;
    const cells = CUTOFFS.map((cutoff) => {
      const kept = mine.filter((row) => row.confidence >= cutoff);
      return `≥${cutoff}: ${pct(kept.filter((row) => row.correct).length, kept.length)} of ${kept.length}`;
    });
    console.log(`  ${question.padEnd(14)} all: ${pct(mine.filter((r) => r.correct).length, mine.length)}   ${cells.join("   ")}`);
  }
  console.log(`  falls back (unsure or no answer, at the app's thresholds): ${pct(fallbacks + errors, n)}`);
  console.log(`  latency p50 ${percentile(latencies, 50)}ms, p95 ${percentile(latencies, 95)}ms`);
  const total = tokens.reduce((sum, t) => sum + t, 0);
  console.log(`  input tokens: ${total} total, ${tokens.length ? Math.round(total / tokens.length) : 0} per call`);
}

void main();
