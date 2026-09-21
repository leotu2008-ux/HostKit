import type { ActivityActor, ActivityRow } from "@/lib/activity";

/**
 * Pure formatting and merge logic for the activity feed — no database, so
 * these are covered by plain unit tests. A `FeedRow` is what a feed row
 * looks like on the wire: `createdAt` is an ISO string the moment it leaves
 * `lib/activity.ts`, so the client never juggles a raw `Date` across a fetch
 * boundary.
 */

export type FeedRow = {
  id: string;
  actor: ActivityActor;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
};

export function toFeedRow(row: ActivityRow): FeedRow {
  return {
    id: row.id,
    actor: row.actor,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt.toISOString(),
  };
}

const ACTOR_LABEL: Record<ActivityActor, string> = {
  agent: "Agent",
  host: "You",
  system: "HostKit",
};

export function actorLabel(actor: ActivityActor): string {
  return ACTOR_LABEL[actor];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" under a minute, then minutes, then hours, then "yesterday"
 *  for anything from 24h up to (not including) 48h, then a short date. */
export function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < MINUTE) return "just now";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MINUTE)}m ago`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}h ago`;
  if (diffMs < 2 * DAY) return "yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Merges a poll's rows into what's already on screen: de-duped by id (the
 *  incoming copy wins, since it's the fresher read), newest first, ties
 *  broken by id so the order is stable even for same-instant rows, capped so
 *  a quiet tab that's been open for hours doesn't grow the DOM forever. */
export function mergeFeed(existing: FeedRow[], incoming: FeedRow[], cap = 100): FeedRow[] {
  const byId = new Map<string, FeedRow>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()]
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    })
    .slice(0, cap);
}

/** The newest `createdAt` across `rows` — the MAX, not `rows[0]`, so an
 *  unsorted merge (or a future re-ordering of mergeFeed) can never rewind
 *  the poll's `after` cursor and re-fetch rows it already has. */
export function latestAt(rows: FeedRow[]): string | null {
  if (rows.length === 0) return null;
  return rows.reduce((max, row) => (row.createdAt > max ? row.createdAt : max), rows[0].createdAt);
}

/** True once nothing has posted within `idleMs` — the signal the poller uses
 *  to stop scheduling itself rather than fetch forever on a dead tab. An
 *  empty feed counts as quiet. */
export function feedIsQuiet(rows: FeedRow[], now: Date, idleMs: number): boolean {
  const latest = latestAt(rows);
  if (latest === null) return true;
  return new Date(latest).getTime() <= now.getTime() - idleMs;
}
