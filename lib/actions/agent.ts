"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { requireEvent } from "@/lib/session";
import { record } from "@/lib/activity";
import { clientIp } from "@/lib/rate-limit";
import { runAgent } from "@/lib/agent/run";

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
    await runAgent(event.id, { reason: "manual", ipKey });
  });

  refresh();
}
