import { after } from "next/server";
import { record } from "@/lib/activity";
import { runAgent, type RunOutcome } from "@/lib/agent/run";

/**
 * "Run the agent" / "Run again" / "Try again" — the host asking for another
 * pass, shared by the two things that can trigger one.
 *
 * There are two because a Server Action's timeout is the *page's*
 * maxDuration (see the maxDuration route segment config docs), and the
 * sidebar's status line is rendered by the shared layout on all six tabs —
 * so a Server Action there would inherit whichever page the host happened to
 * be on, at the platform default, while runAgent budgets 45s inside
 * `after()`. A POST Route Handler carries its own ceiling
 * (app/(app)/events/[id]/agent/run/route.ts). The Overview page's form stays
 * a Server Action, covered by that page's own `maxDuration = 60`.
 *
 * Neither caller may drift from the other: what the host sees on the feed
 * has to be the same line wherever they pressed, so both come through here.
 */

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
 * Records the press and schedules the run.
 *
 * `ipKey` is passed in rather than read here: runAgent must also be callable
 * from the cron, which has no request to read an address from, and a Server
 * Component's `after()` callback may not touch `headers()` at all.
 */
export async function startAgentRun(eventId: string, ipKey: string | null): Promise<void> {
  // Recorded synchronously, before after(): this is what the feed and the
  // sidebar's status line react to on the caller's refresh/redirect, so the
  // host sees the press land instead of waiting on the next poll.
  await record(eventId, {
    actor: "host",
    kind: "run_started",
    title: "You asked the agent to take another look",
  });

  after(async () => {
    const outcome = await runAgent(eventId, { reason: "manual", ipKey });
    if (outcome.ran) return;
    const title = outcomeLine(outcome);
    if (title) {
      await record(eventId, { actor: "agent", kind: "run_finished", title });
    }
  });
}
