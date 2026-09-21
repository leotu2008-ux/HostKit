"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { requireEvent } from "@/lib/session";
import { record } from "@/lib/activity";
import { clientIp } from "@/lib/rate-limit";
import { runAgent, type RunOutcome } from "@/lib/agent/run";

/**
 * Why a press didn't turn into a run, in the host's terms. A press that
 * produced nothing has to say so: the "You asked the agent…" line below is
 * already on the feed by then, and leaving it without an answer reads as the
 * agent having silently ignored them.
 *
 * `run_finished` rather than a new kind — ActivityKind is closed so every
 * renderer can switch over it exhaustively, and what this is, is the terminal
 * line for the run the host just asked for.
 */
function outcomeLine(outcome: RunOutcome): string | null {
  switch (outcome.skipped) {
    case "running":
      return "The agent is already on it";
    case "rate-limited":
      return "Too many runs this hour — try again later";
    case "gone":
      // The event was deleted under us; there's no feed left to post to.
      return null;
    default:
      // "unchanged"/"incomplete" can't happen for a manual run (both are
      // gated on reason === "brief"), so anything else is the never-throws
      // boundary having swallowed a failure.
      return "The agent couldn't start";
  }
}

/**
 * "Run the agent" / "Run again" / "Try again" — the host asking for another
 * pass, from the Overview or the sidebar's status line.
 *
 * Unlike the brief-save trigger this doesn't need a complete brief: planSteps
 * works out what's runnable from whatever has been filled in, so a host with
 * a budget but no headcount still gets a plan out of it.
 */
export async function runAgentAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  // Recorded synchronously, before after(): this is what the feed and the
  // sidebar's status line react to on the refresh() below, so the host sees
  // the press land instead of waiting on the next poll.
  await record(event.id, {
    actor: "host",
    kind: "run_started",
    title: "You asked the agent to take another look",
  });

  // Read the request data BEFORE after(): runAgent must also be callable from
  // the cron, which has no headers to read.
  const ipKey = event.ownerId ? null : clientIp(await headers());
  after(async () => {
    const outcome = await runAgent(event.id, { reason: "manual", ipKey });
    if (outcome.ran) return;
    const title = outcomeLine(outcome);
    if (title) {
      await record(event.id, { actor: "agent", kind: "run_finished", title });
    }
  });

  refresh();
}
