"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AgentStatusView } from "@/lib/activity";
import { actorLabel, feedIsQuiet, latestAt, mergeFeed, relativeTime, type FeedRow } from "@/lib/activity-format";
import { SectionHeading, EmptyState, cx } from "@/components/ui";

/**
 * The Overview's live "what's happening" feed.
 *
 * Vercel is serverless, so there's no long-lived connection to push updates
 * down — this polls instead, on a self-scheduling `setTimeout` (never
 * `setInterval`, which would pile up ticks rather than wait for one poll to
 * finish before starting the next). The poll is gated on
 * `document.visibilityState` so a background tab never spends a fetch on a
 * feed nobody's looking at, and it stops scheduling itself entirely once the
 * feed has been quiet for a while — a night with nothing left to report
 * shouldn't poll forever — unless the agent is mid-run, in which case
 * something is always about to post.
 */

const ACTOR_DOT: Record<FeedRow["actor"], string> = {
  agent: "bg-ink",
  host: "bg-forest",
  system: "bg-line-strong",
};

export function ActivityFeed({
  eventId,
  initial,
  agent: initialAgent,
  now,
  pollMs = 8_000,
  idleStopMs = 10 * 60_000,
}: {
  eventId: string;
  initial: FeedRow[];
  agent: AgentStatusView;
  now: string;
  pollMs?: number;
  idleStopMs?: number;
}): React.JSX.Element {
  const [rows, setRows] = useState<FeedRow[]>(initial);
  const [agent, setAgent] = useState<AgentStatusView>(initialAgent);
  const [clock, setClock] = useState(() => new Date(now));
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);

  // Refs mirror the latest state for the self-scheduling loop below, which
  // closes over them once (its effect deps are stable) and must never read a
  // stale render's values. Written from an effect, never during render.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const agentRef = useRef(agent);
  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);
  // The "resume" button calls into the running loop through a ref instead of
  // toggling a dependency that would tear the effect down and abort an
  // in-flight fetch out from under itself.
  const resumeRef = useRef<() => void>(() => {});

  // SSR and the first client render agree on "now" (the `now` prop); once
  // mounted, correct to the real clock and keep it ticking. Both updates run
  // from a timer callback, never synchronously in the effect body.
  useEffect(() => {
    const tick = () => setClock(new Date());
    const immediate = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stoppedLocal = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let backoff = 0;

    function scheduleNext(delay: number) {
      if (cancelled || stoppedLocal) return;
      timeoutId = setTimeout(tick, delay);
    }

    async function tick() {
      if (cancelled || stoppedLocal) return;

      if (document.visibilityState !== "visible") {
        scheduleNext(pollMs);
        return;
      }

      if (feedIsQuiet(rowsRef.current, new Date(), idleStopMs) && agentRef.current.status !== "running") {
        setPaused(true);
        return; // no reschedule — resumeRef re-arms this
      }

      controller = new AbortController();
      try {
        const after = latestAt(rowsRef.current) ?? "";
        const res = await fetch(
          `/api/v1/events/${eventId}/activity?after=${encodeURIComponent(after)}`,
          { signal: controller.signal },
        );
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          stoppedLocal = true;
          setStopped(true);
          return;
        }
        if (!res.ok) throw new Error(`activity poll failed: ${res.status}`);

        const data = (await res.json()) as { rows: FeedRow[]; agent: AgentStatusView };
        if (cancelled) return;
        setRows((prev) => mergeFeed(prev, data.rows));
        setAgent(data.agent);
        backoff = 0;
        scheduleNext(pollMs);
      } catch {
        if (cancelled || controller?.signal.aborted) return;
        backoff += 1;
        scheduleNext(Math.min(pollMs * 2 ** backoff, 60_000));
      }
    }

    function resume() {
      if (cancelled || stoppedLocal) return;
      if (timeoutId) clearTimeout(timeoutId);
      setPaused(false);
      tick();
    }
    resumeRef.current = resume;

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      // Coming back to the tab is worth an immediate catch-up, even if
      // polling had paused for being quiet — the visit itself is new signal.
      resume();
    }
    document.addEventListener("visibilitychange", onVisible);

    scheduleNext(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId, pollMs, idleStopMs]);

  return (
    <div>
      <SectionHeading
        title="What's happening"
        action={
          stopped ? null : paused ? (
            <button
              type="button"
              onClick={() => resumeRef.current()}
              className="text-[12px] text-ink-mute underline-offset-2 hover:text-ink hover:underline"
            >
              Paused — resume
            </button>
          ) : (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-forest" />
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" body="Save the brief and the agent gets going." />
      ) : (
        <ol aria-live="polite" className="space-y-3">
          {rows.map((row) => {
            const content = (
              <div className="flex items-start gap-3">
                <span aria-hidden className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", ACTOR_DOT[row.actor])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] tracking-wide text-ink-mute uppercase">{actorLabel(row.actor)}</p>
                  <p className="font-medium text-ink">{row.title}</p>
                  {row.body ? <p className="text-[13px] text-ink-soft">{row.body}</p> : null}
                </div>
                <span className="shrink-0 text-[12px] text-ink-mute">{relativeTime(row.createdAt, clock)}</span>
              </div>
            );
            return (
              <li key={row.id}>
                {row.href ? (
                  <Link href={row.href} className="-mx-2 block rounded-lg px-2 py-1 hover:bg-sunk">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
