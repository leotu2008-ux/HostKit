/**
 * What one sweep should do, decided in pure code.
 *
 * The subtle part is that an unfinished `AgentRun` row is not automatically
 * retryable. runAgent derives the brief hash from the event as it is *now*
 * and only ever claims the row for that hash — so a FAILED or stale-RUNNING
 * row whose brief has since changed can never be re-claimed, never has
 * `attempts` incremented, and keeps matching the sweep's selector forever.
 * Left alone, the oldest such rows would fill every slot of every sweep and
 * starve out all real work. So they are retired.
 *
 * Retiring one is not the same as writing its event off, and the two have to
 * be told apart. If the brief moved on and its new run already happened, the
 * row is just the old attempt's corpse and re-running would redo finished
 * work and re-post its feed lines daily. If the brief moved on and the
 * follow-up run was *lost* — a dropped `after()`, an event written through
 * the iOS API — then nothing has planned the event as it now stands, and
 * clause (b) of the sweep's own query can't see it either (that one only
 * looks at events with no runs at all). `currentBriefHasRun` is what
 * separates them.
 */

export type SweepCandidate = {
  /** The AgentRun row's id. */
  id: string;
  eventId: string;
  /** The brief hash this row was claimed for. */
  briefHash: string;
  /** The event's brief hash right now. */
  currentBriefHash: string;
  /** Whether any AgentRun row exists for the event's *current* hash. Always
   *  true when `briefHash === currentBriefHash` — this row is that row. */
  currentBriefHasRun: boolean;
};

export type SweepPlan = {
  /** Event ids to hand to runAgent, in the order given, deduped and capped. */
  run: string[];
  /** AgentRun ids to retire — rows no run will ever reach again. */
  retire: string[];
};

/**
 * `candidates` are unfinished runs (oldest first); `freshEventIds` are events
 * that have never had a run at all. `retire` is deliberately uncapped: it's
 * one cheap status write per row, and leaving any behind would re-starve the
 * next sweep.
 */
export function sweepPlan(
  candidates: SweepCandidate[],
  freshEventIds: string[],
  limit: number,
): SweepPlan {
  const retire: string[] = [];
  const runnable: string[] = [];

  for (const candidate of candidates) {
    if (candidate.briefHash === candidate.currentBriefHash) {
      runnable.push(candidate.eventId);
      continue;
    }
    retire.push(candidate.id);
    // The brief moved on and nothing has worked it since: the event still
    // needs planning, and this sweep is the only thing that will notice.
    if (!candidate.currentBriefHasRun) runnable.push(candidate.eventId);
  }

  // An event can have several unfinished rows, and can appear in both lists;
  // it only ever needs one run.
  const run = [...new Set([...runnable, ...freshEventIds])].slice(0, limit);

  return { run, retire };
}
