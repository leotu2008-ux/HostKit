import { timingSafeEqual } from "node:crypto";
import { apiError, json } from "@/lib/api/http";
import { syncAll, syncSchool } from "@/lib/campus/sync";

/**
 * Pulls every school's official calendar (vercel.json schedules this daily;
 * Vercel sends `Authorization: Bearer $CRON_SECRET`). Run it by hand with
 * the same header (never in the URL, which gets logged), or
 * `?school=babson.edu` for one school. Without CRON_SECRET set, only local
 * development may call it.
 */

function sameSecret(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  if (secret ? !sameSecret(provided, secret) : process.env.NODE_ENV === "production") {
    return apiError("Not allowed.", 401);
  }
  const school = new URL(request.url).searchParams.get("school");
  const results = school ? await syncSchool(school) : await syncAll();
  return json({
    ok: results.every((r) => r.ok),
    results,
  });
}
