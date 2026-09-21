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
 * the iOS API — then nothing has planned the event as it now stands.
 * `currentBriefHasRun` is what separates them.
 *
 * That same fact is the whole test for the sweep's other input, the scan of
 * every PLANNING event with a complete brief. An event whose last run is
 * DONE has no unfinished row to be a candidate, and isn't an event with no
 * runs at all either — so if its brief was then edited and the follow-up
 * `after()` never fired, nothing but "the brief it carries now has no
 * AgentRun row" can notice. Hence one question asked of both inputs rather
 * than a selector per gap.
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

/** One event off the sweep's candidate scan: PLANNING, brief complete. */
export type SweepEvent = {
  id: string;
  /** Whether any AgentRun row exists for the brief this event carries now. */
  currentBriefHasRun: boolean;
};

export type SweepPlan = {
  /** Event ids to hand to runAgent, in the order given, deduped and capped. */
  run: string[];
  /** AgentRun ids to retire — rows no run will ever reach again. */
  retire: string[];
};

/**
 * `candidates` are unfinished runs (oldest first); `events` are the scanned
 * PLANNING events with a complete brief, soonest first. `retire` is
 * deliberately uncapped: it's one cheap status write per row, and leaving any
 * behind would re-starve the next sweep.
 */
export function sweepPlan(
  candidates: SweepCandidate[],
  events: SweepEvent[],
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

  // An event can have several unfinished rows, and can appear in both lists
  // — a QUEUED row is an unfinished candidate *and* a row for the current
  // brief; it only ever needs one run.
  const unplanned = events.filter((event) => !event.currentBriefHasRun).map((event) => event.id);
  const run = [...new Set([...runnable, ...unplanned])].slice(0, limit);

  return { run, retire };
}
