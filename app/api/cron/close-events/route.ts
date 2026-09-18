import { timingSafeEqual } from "node:crypto";
import { apiError, json } from "@/lib/api/http";
import { completeFinishedEvents } from "@/lib/outcomes";

/**
 * Marks finished events COMPLETED and freezes their outcome (lib/outcomes.ts).
 *
 * Same guard as the campus sync: Vercel sends `Authorization: Bearer
 * $CRON_SECRET`, and without CRON_SECRET set the route only answers outside
 * production. Safe to run by hand, and safe to run twice — the sweep is
 * idempotent.
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

  const result = await completeFinishedEvents();
  return json({ ok: true, ...result });
}
