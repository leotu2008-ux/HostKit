import { noul, type EntryType } from "@typesafe-ai/sdk";
import { decide, jevEnabled, logDecision, summarize, yesNo, type NoulBand } from "@/lib/ai/decide";
import { numbersAreGrounded } from "@/lib/agent/briefing";

/**
 * The guardrail: every line Claude writes for Hosty is checked by Jev before
 * anyone reads it, against the two rules the README makes about Hosty's words.
 *
 * - **The budget stays private.** A line must not reveal, hint at or ask about
 *   how much the host can spend. That's a judgment call ("we're working with
 *   about five grand" says it without a number), so Jev makes it.
 * - **Hosty says only what's in the record.** Jev spots a line that states a
 *   price, a date, a time or a headcount; code then pulls the values out and
 *   compares them with the record, because Jev reads numbers and dates as text.
 *   A value code can't pull out ("mid-October", "a few hundred") can't be
 *   checked, so it fails rather than passing on trust.
 *
 * `null` means Jev wasn't asked or didn't answer, and the caller does exactly
 * what it did before this file existed. Nothing here sends anything.
 */

/** Tuned toward catching a leak: a line only has to look fairly likely to
 *  mention the budget to be sent back. */
export const BUDGET_BAND: NoulBand = { yesAt: 0.6, noAt: 0.25 };
export const VALUES_BAND: NoulBand = { yesAt: 0.6, noAt: 0.25 };

export const GUARDRAIL_QUESTIONS = {
  revealsBudget: noul(
    "This message reveals, hints at, or asks about how much money the host can spend on the event.",
    {
      true: "Yes if it states or implies the host's budget or spending limit in any form: an amount, a range, a rounded figure ('about five grand', 'mid-four figures'), a comparison ('we can stretch a bit'), or a question about what the host can afford.",
      false: "No if it never touches the host's own spending. Prices the vendor or venue charges, a guest count, a date or a time are not the host's budget.",
    },
  ),
  statesValues: noul(
    "This message states a specific price, date, time of day, number of days, or number of people.",
    {
      true: "Yes if any of those appears, written as digits or as words ('tomorrow', 'Friday', 'a dozen people', 'twenty dollars').",
      false: "No if it mentions none of them, only names, places, tasks or general advice.",
    },
  ),
};

export type DraftCheck =
  | { verdict: "pass" }
  | { verdict: "fail"; reason: string }
  | { verdict: "unsure"; reason: string };

export type DraftContext = {
  /** For the decision log; without it nothing is logged. */
  eventId?: string;
  /** What the line is, for the log ("digest", "venue reason: Lakeside"). */
  subject: string;
  /** Every number the line may state, computed by code. */
  allowedNumbers: number[];
  /**
   * Words for a value the line may use, as handed to the writer ("tomorrow").
   * Matched as whole words; digits in them are not allowed numbers.
   */
  allowedPhrases?: string[];
  budgetMs?: number;
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50,
};
// "Hundred" and "thousand" are left out on purpose: "a few hundred" names no
// value code could check, so it has to fail as unreadable, not pass as 100.

const DAY_WORDS = [
  "today", "tonight", "tomorrow", "yesterday", "weekend",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

const MONTHS = [
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
];
// "May" is left out on purpose: as a word it's usually the verb ("you may
// want to…"), and reading it as a date would fail a grounded line.

/**
 * Checks what code can check: every value it can pull out of the line is one
 * the record holds. `checkable` is false when the line has no value code can
 * read at all, which is what's left when Jev says one is there.
 */
export function valuesMatchRecord(
  text: string,
  allowedNumbers: number[],
  allowedPhrases: string[] = [],
): { checkable: boolean; grounded: boolean } {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z]+/g) ?? [];
  const phrases = allowedPhrases.join(" ").toLowerCase();
  const phraseWords = new Set(phrases.match(/[a-z]+/g) ?? []);

  const digitRuns = text.match(/\d+/g) ?? [];
  const numberWords = words.filter((word) => word in NUMBER_WORDS);
  const dayWords = words.filter((word) => DAY_WORDS.includes(word) || MONTHS.includes(word));

  const checkable = digitRuns.length + numberWords.length + dayWords.length > 0;
  const grounded =
    numbersAreGrounded(text, allowedNumbers) &&
    numberWords.every((word) => allowedNumbers.includes(NUMBER_WORDS[word]) || phraseWords.has(word)) &&
    dayWords.every((word) => phraseWords.has(word));
  return { checkable, grounded };
}

/** Asks Jev about one line and settles the answer with code. */
export async function checkDraft(text: string, ctx: DraftContext): Promise<DraftCheck | null> {
  const state: EntryType = { message: text };
  const decision = await decide("guardrail", state, GUARDRAIL_QUESTIONS, {
    budgetMs: ctx.budgetMs,
    fetch: ctx.fetch,
    env: ctx.env,
  });

  if (!decision) {
    if (ctx.eventId && jevEnabled("guardrail", ctx.env)) {
      await logDecision(ctx.eventId, {
        point: "guardrail",
        subject: ctx.subject,
        answers: {},
        verdict: "no answer",
        model: null,
        fellBack: true,
      });
    }
    return null;
  }

  const budget = yesNo(decision.answers.revealsBudget, BUDGET_BAND);
  const values = yesNo(decision.answers.statesValues, VALUES_BAND);

  let check: DraftCheck;
  if (budget === "yes") {
    check = { verdict: "fail", reason: "it mentions how much the host can spend" };
  } else if (values === "yes") {
    const { checkable, grounded } = valuesMatchRecord(text, ctx.allowedNumbers, ctx.allowedPhrases);
    check = !checkable
      ? { verdict: "fail", reason: "it states a value in words that can't be checked against the record" }
      : !grounded
        ? { verdict: "fail", reason: "it states a value that isn't in the record" }
        : budget === "unsure"
          ? { verdict: "unsure", reason: "it may touch on the budget" }
          : { verdict: "pass" };
  } else if (budget === "unsure" || values === "unsure") {
    check = {
      verdict: "unsure",
      reason: budget === "unsure" ? "it may touch on the budget" : "it may state a value",
    };
  } else {
    check = { verdict: "pass" };
  }

  if (ctx.eventId) {
    await logDecision(ctx.eventId, {
      point: "guardrail",
      subject: ctx.subject,
      answers: summarize(decision.answers),
      verdict: check.verdict,
      model: decision.model,
      fellBack: false,
      reason: check.verdict === "pass" ? undefined : check.reason,
      ms: decision.ms,
      inputTokens: decision.inputTokens,
    });
  }
  return check;
}
