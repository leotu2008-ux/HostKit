import { db } from "@/lib/db";
import { missingBriefFields, type BriefFacts, type BriefField } from "@/lib/brief";
import type { AgentRunStatus } from "@/generated/prisma/enums";

/**
 * The event's activity feed: an append-only log of what happened while
 * running it. Nothing here ever edits or deletes a line — the log is the
 * history, not a status a later write can rewrite — and `kind` is a closed
 * union so every renderer (the web feed, iOS, a future digest) can switch
 * over it exhaustively instead of falling back to a generic bullet. Not
 * every write to an event earns a line: shortlist toggles, guest
 * edits/removals, cover/photo changes, visibility changes,
 * saveCollaboratorMessageAction, run-sheet edits, RSVP downgrades and
 * check-in undo are all deliberately quiet — the feed is for what moved the
 * event forward, not everything that touched its row.
 */

export type ActivityActor = "agent" | "host" | "system";

export type ActivityKind =
  | "event_created"
  | "brief_saved"
  | "run_started"
  | "run_finished"
  | "step_failed"
  | "step_skipped"
  | "plan_drafted"
  | "venues_attached"
  | "venue_search_empty"
  | "inquiries_drafted"
  | "published"
  | "unpublished"
  | "venue_attached"
  | "collaborator_sent"
  | "collaborator_confirmed"
  | "inquiry_sent"
  | "inquiry_booked"
  | "inquiry_declined"
  | "blast_sent"
  | "guest_rsvp"
  | "guest_checked_in"
  | "task_done";

export type ActivityLine = {
  actor: ActivityActor;
  kind: ActivityKind;
  title: string;
  body?: string | null;
  href?: string | null;
};

/** Posts one line. Never throws — a feed that fails the action it's
 *  recording is worse than a feed with a gap in it (same shape as
 *  lib/notify.ts's notify()). */
export async function record(eventId: string, line: ActivityLine): Promise<void> {
  try {
    await db.activity.create({
      data: {
        eventId,
        actor: line.actor,
        kind: line.kind,
        title: line.title,
        body: line.body ?? null,
        href: line.href ?? null,
      },
    });
  } catch (error) {
    console.error("[activity] failed", error);
  }
}

/** Posts several lines in one round trip. Same never-throws guarantee. */
export async function recordMany(eventId: string, lines: ActivityLine[]): Promise<void> {
  if (lines.length === 0) return;
  try {
    await db.activity.createMany({
      data: lines.map((line) => ({
        eventId,
        actor: line.actor,
        kind: line.kind,
        title: line.title,
        body: line.body ?? null,
        href: line.href ?? null,
      })),
    });
  } catch (error) {
    console.error("[activity] failed", error);
  }
}

export type ActivityRow = {
  id: string;
  actor: ActivityActor;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
};

/** Newest first. `after` (an exclusive `createdAt >`) is how a poll asks for
 *  only what it hasn't seen; `limit` defaults to 50 and never exceeds 100. */
export async function loadActivity(
  eventId: string,
  opts?: { after?: Date | null; limit?: number },
): Promise<ActivityRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const rows = await db.activity.findMany({
    where: {
      eventId,
      ...(opts?.after ? { createdAt: { gt: opts.after } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor as ActivityActor,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt,
  }));
}

export type AgentStatusView = {
  status: "idle" | "queued" | "running" | "failed" | "done";
  lastRunAt: string | null;
  startedAt: string | null;
  needs: BriefField[];
};

const STATUS_VIEW: Record<AgentRunStatus, AgentStatusView["status"]> = {
  QUEUED: "queued",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
};

/** The sidebar/Overview's read of the agent: the latest run for this event,
 *  plus what the brief is still missing regardless of that run. */
export async function loadAgentStatus(
  event: BriefFacts & { id: string },
): Promise<AgentStatusView> {
  const needs = missingBriefFields(event);
  const run = await db.agentRun.findFirst({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  if (!run) return { status: "idle", lastRunAt: null, startedAt: null, needs };
  return {
    status: STATUS_VIEW[run.status],
    lastRunAt: (run.finishedAt ?? run.startedAt)?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    needs,
  };
}
