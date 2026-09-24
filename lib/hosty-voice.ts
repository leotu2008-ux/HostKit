import type { FeedRow } from "@/lib/activity-format";
import type { Briefing } from "@/lib/agent/briefing";

/**
 * Hosty's voice: what the agent and the host did, as chat lines.
 *
 * Pure and deterministic (no model), and grounded: a sentence here only
 * reuses words and numbers already saved on the row, so Hosty can't say
 * anything the feed didn't record. Rows are phrased when shown, not when
 * saved, so old history reads the same way. A kind nobody taught this file
 * still shows up, as its saved title and body.
 */

export type ChatSpeaker = "hosty" | "you" | "note";

export type ChatMessage = {
  id: string;
  speaker: ChatSpeaker;
  text: string;
  action?: { label: string; href: string };
  createdAt: string;
};

const SPEAKER: Record<FeedRow["actor"], ChatSpeaker> = {
  agent: "hosty",
  host: "you",
  system: "note",
};

const ACTION_LABEL: Record<string, string> = {
  plan_drafted: "Open the plan",
  venues_attached: "See the venues",
  inquiries_drafted: "Review the drafts",
};

/** Titles of run_finished rows that aren't a finished run's summary — the
 *  outcome lines lib/agent/trigger.ts records when a run never started. */
const RUN_OUTCOME: Record<string, string> = {
  "The agent is already on it": "I'm already on it.",
  "Too many runs this hour — try again later": "I've run a lot this hour. Try me again a bit later.",
  "The agent couldn't start": "I couldn't get started. Try again in a moment.",
};

const PLAN_SOURCE: Record<string, string> = {
  "from the template": "I used the standard template for now.",
  "written for this event": "I wrote it for this event.",
};

/** The agent steps save lists as "A · B · C". */
function parts(body: string | null): string[] {
  return (body ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** ["A"] → "A", ["A", "B"] → "A and B", ["A", "B", "C"] → "A, B and C". */
export function naturalList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Lowercases a leading capital only when it starts an ordinary word, so
 *  "Catering" becomes "catering" but "AV & production" keeps its acronym. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z']/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** Ends `text` with a full stop unless it already ends a sentence. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** A saved reason, spoken by Hosty himself: the agent steps write their
 *  reasons as lowercase fragments and sometimes name Hosty in the third
 *  person ("Hosty doesn't scout that city yet"). run.ts's out-of-time note
 *  promises a pickup the sweep stops making after its last attempt, so
 *  Hosty only says what happened. */
function inHostysWords(reason: string): string {
  if (/^ran out of time\b/i.test(reason.trim())) return "I ran out of time before getting to it.";
  const spoken = sentence(reason.replace(/\bHosty doesn't\b/g, "I don't"));
  return spoken.charAt(0).toUpperCase() + spoken.slice(1);
}

/** What run.ts calls each step in a run's summary ("Done: plan, venues"). */
const STEP_NAME: Record<string, string> = {
  plan: "the plan",
  venues: "venues",
  vendors: "vendor inquiries",
};

/** A finished run's summary — "Done: plan, venues · Left undone: vendors" —
 *  as Hosty would say it. Only the steps the row names; never a count. */
function runSummary(row: FeedRow): string {
  const listed = (label: string) => {
    const part = parts(row.body).find((p) => p.startsWith(`${label}: `));
    if (!part) return [];
    return part
      .slice(label.length + 2)
      .split(", ")
      .map((step) => STEP_NAME[step.trim()] ?? step.trim());
  };
  const done = listed("Done");
  const undone = listed("Left undone");
  if (undone.length > 0) {
    return done.length > 0
      ? `I finished ${naturalList(done)}, but couldn't finish ${naturalList(undone)}.`
      : `I couldn't finish ${naturalList(undone)}.`;
  }
  if (row.title === "The agent finished with problems") return "Some of it didn't work this time.";
  return done.length > 0 ? `All done for now. I finished ${naturalList(done)}.` : "All done for now.";
}

function hostyText(row: FeedRow): string | null {
  switch (row.kind) {
    case "run_started":
      return "On it. Let me take a look.";
    case "run_finished":
      if (row.title === "The agent finished" || row.title === "The agent finished with problems") {
        return runSummary(row);
      }
      return RUN_OUTCOME[row.title] ?? null;
    case "plan_drafted": {
      const all = parts(row.body);
      const source = all.find((part) => part in PLAN_SOURCE);
      const counts = all.filter((part) => part !== source);
      const lead = counts.length > 0 ? `I drafted your plan: ${naturalList(counts)}.` : "I drafted your plan.";
      return source ? `${lead} ${PLAN_SOURCE[source]}` : lead;
    }
    case "venues_attached": {
      const count = row.title.match(/^(\d+) venues? lined up$/);
      if (!count) return null;
      const n = Number(count[1]);
      const names = parts(row.body);
      const list = names.length > 0 ? `: ${naturalList(names)}` : "";
      return `I lined up ${n} ${n === 1 ? "venue" : "venues"}${list}. Nothing's been sent.`;
    }
    case "venue_search_empty":
      return "I couldn't find venues nearby yet.";
    case "inquiries_drafted": {
      if (row.title === "No vendors to draft for") {
        return "I couldn't find vendors in the catalog that fit this date yet.";
      }
      const count = row.title.match(/^(\d+) vendor inquir(?:y|ies) drafted$/);
      if (!count) return null;
      const n = Number(count[1]);
      const kinds = parts(row.body).map(lowerFirst);
      const list = kinds.length > 0 ? `: ${naturalList(kinds)}` : "";
      const waiting = n === 1 ? "It's waiting for you to send." : "They're waiting for you to send.";
      return `I drafted ${n} vendor ${n === 1 ? "inquiry" : "inquiries"}${list}. ${waiting}`;
    }
    case "step_skipped": {
      const lead = `I ${lowerFirst(sentence(row.title))}`;
      return row.body ? `${lead} ${inHostysWords(row.body)}` : lead;
    }
    case "step_failed":
      // No promise to retry: the sweep gives up after MAX_ATTEMPTS, so
      // "I'll try again" would sometimes be untrue.
      return `I ${lowerFirst(row.title.trim())} this time.`;
    default:
      return null;
  }
}

function youText(row: FeedRow): string | null {
  switch (row.kind) {
    case "brief_saved": {
      const fields = parts(row.body).map(lowerFirst);
      return fields.length > 0 ? `Updated the brief: ${naturalList(fields)}` : "Updated the brief";
    }
    case "run_started":
      return "Asked Hosty to take another look";
    default:
      return null;
  }
}

export function toChatMessage(row: FeedRow): ChatMessage {
  const speaker = SPEAKER[row.actor];
  const phrased =
    speaker === "hosty" ? hostyText(row) : speaker === "you" ? youText(row) : row.title;
  const text = phrased ?? (row.body ? `${row.title} — ${row.body}` : row.title);
  return {
    id: row.id,
    speaker,
    text,
    createdAt: row.createdAt,
    ...(row.href ? { action: { label: ACTION_LABEL[row.kind] ?? "Open", href: row.href } } : {}),
  };
}

/** The feed as a chat reads it: oldest first. `mergeFeed` keeps rows newest
 *  first for the poller, so the flip happens here, at display time. */
export function toChatThread(rows: FeedRow[]): ChatMessage[] {
  return [...rows]
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    })
    .map(toChatMessage);
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** The side panel's opening line. */
export function briefingIntro(briefing: Briefing, firstName: string | null): string {
  const { now, soon, total } = briefing.counts;
  if (total === 0) return "All quiet. Nothing needs you today.";
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  if (now === 0) {
    return `${hi} nothing's urgent. ${soon === 1 ? "One thing is" : `${soon} things are`} coming up:`;
  }
  const today = now === 1 ? "one thing needs you today" : `${now} things need you today`;
  const upcoming = soon === 0 ? "" : soon === 1 ? " and one is coming up" : ` and ${soon} are coming up`;
  return `${hi} ${today}${upcoming}:`;
}
