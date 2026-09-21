import { timingSafeEqual } from "node:crypto";
import { apiError, json } from "@/lib/api/http";
import { sweepAgentRuns } from "@/lib/agent/sweep";

/**
 * Picks up the agent runs that never finished, and the events that never
 * started one (lib/agent/sweep.ts).
 *
 * Same guard as the campus sync and close-events crons: Vercel sends
 * `Authorization: Bearer $CRON_SECRET`, and without CRON_SECRET set the route
 * only answers outside production. Safe to run by hand, and safe to run
 * twice — every run claims its AgentRun row before doing anything, so a
 * second sweep finds nothing to pick up.
 */

function sameSecret(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret ? !sameSecret(provided, secret) : process.env.NODE_ENV === "production") {
    return apiError("Not allowed.", 401);
  }

  const result = await sweepAgentRuns();
  return json({ ok: true, ...result });
}
