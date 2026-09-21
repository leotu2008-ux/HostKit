"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireEvent } from "@/lib/session";
import { clientIp } from "@/lib/rate-limit";
import { startAgentRun } from "@/lib/agent/trigger";

/**
 * "Run the agent" on the Overview page — the host asking for another pass on
 * a brief that hasn't changed.
 *
 * Unlike the brief-save trigger this doesn't need a complete brief: planSteps
 * works out what's runnable from whatever has been filled in, so a host with
 * a budget but no headcount still gets a plan out of it.
 *
 * A Server Action's timeout is the page's, so this only has room to finish
 * because app/(app)/events/[id]/page.tsx sets `maxDuration = 60`. The
 * sidebar's copy of this button is rendered by the layout on all six tabs
 * and can't rely on any one page's ceiling — it posts to
 * app/(app)/events/[id]/agent/run/route.ts instead.
 */
export async function runAgentAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);

  // Read the request data here rather than inside the scheduled run: runAgent
  // must also be callable from the cron, which has no headers to read.
  const ipKey = event.ownerId ? null : clientIp(await headers());
  await startAgentRun(event.id, ipKey);

  refresh();
}
