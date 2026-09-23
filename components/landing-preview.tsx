"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { HostyMark } from "@/components/hosty-mark";

/**
 * The landing page's preview panel: a brief on the left, what the agent
 * hands back on the right. Once it scrolls into view it plays the exchange
 * through, once: the brief types itself in, Hosty types for
 * a beat, then the tasks and the budget arrive one line at a time.
 *
 * The server renders the finished panel. The play state is entered only on
 * the client, before first paint, and never for a reader who has asked for
 * reduced motion — so the example is always there to read, and the
 * animation is decoration on top of it.
 *
 * The example is representative of a real draft — the budget really is
 * split by event kind, and the tasks really are counted back from the date
 * — but written here rather than generated. components/landing.tsx says
 * more about which of the landing copy is ahead of the code.
 */

/** The brief on the left, as a host would type it. */
const BRIEF: ReadonlyArray<readonly [string, string]> = [
  ["Kind", "Mixer"],
  ["When", "Thu 12 March, 8pm"],
  ["Guests", "120"],
  ["Budget", "$5,000"],
];

const DRAFT_TASKS: ReadonlyArray<readonly [string, string]> = [
  ["21 days out", "Lock the date, headcount and budget"],
  ["18 days out", "Book the room"],
  ["12 days out", "Confirm the guest cap with the venue"],
  ["6 days out", "Send invitations"],
  ["2 days out", "Confirm final headcount with the caterer"],
];

const DRAFT_BUDGET: ReadonlyArray<readonly [string, string]> = [
  ["Venue", "$2,000"],
  ["Catering", "$1,500"],
  ["Music / DJ", "$1,000"],
  ["Decor", "$500"],
];

/** Before the first keystroke: long enough for the panel's own rise-in to
 *  finish, and it reads as the host pausing to think. */
const LEAD_MS = 1100;
const TYPE_MS = 34;
const ROW_PAUSE_MS = 260;
const THINK_MS = 800;
const TASK_MS = 170;
const CHIP_MS = 110;

type Frame = {
  /** Brief rows fully typed; the row at this index is the one being typed. */
  row: number;
  /** Characters shown of the row being typed. */
  chars: number;
  thinking: boolean;
  tasks: number;
  chips: number;
};

const DONE: Frame = {
  row: BRIEF.length,
  chars: 0,
  thinking: false,
  tasks: DRAFT_TASKS.length,
  chips: DRAFT_BUDGET.length,
};

const START: Frame = { row: 0, chars: 0, thinking: false, tasks: 0, chips: 0 };

/** Every frame of the play-through with the delay that precedes it. */
function timeline(): Array<[number, Frame]> {
  const frames: Array<[number, Frame]> = [];
  let frame = START;
  const push = (delay: number, next: Partial<Frame>) => {
    frame = { ...frame, ...next };
    frames.push([delay, frame]);
  };

  BRIEF.forEach(([, value], row) => {
    for (let chars = 1; chars <= value.length; chars++) {
      const pause = row === 0 ? LEAD_MS : ROW_PAUSE_MS;
      push(chars === 1 ? pause : TYPE_MS, { row, chars });
    }
    push(0, { row: row + 1, chars: 0 });
  });

  push(ROW_PAUSE_MS, { thinking: true });
  push(THINK_MS, { thinking: false });
  DRAFT_TASKS.forEach((_, i) => push(TASK_MS, { tasks: i + 1 }));
  DRAFT_BUDGET.forEach((_, i) => push(i === 0 ? ROW_PAUSE_MS : CHIP_MS, { chips: i + 1 }));
  // End on the very object the server rendered with, so "finished" is an
  // identity check rather than a field-by-field one.
  frames.push([0, DONE]);

  return frames;
}

export function LandingPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame>(DONE);
  const playing = frame !== DONE;

  // Before first paint: reset the panel to empty and wait for the viewport.
  // Only while the section it sits in is still held at opacity 0 by the
  // hero's `.rise` (the lead-in below outlasts that rise). Once the rise has
  // begun showing the finished card, emptying it would flash, so the card
  // is left as the server drew it. The reset has to be synchronous in a
  // layout effect for the same reason — after paint would be too late.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const entrance = element.closest(".rise")?.getAnimations()[0];
    if (entrance?.effect?.getComputedTiming().progress !== 0) return;

    setFrame(START);

    let timer: number | undefined;

    const play = () => {
      const frames = timeline();
      let i = 0;
      const step = () => {
        if (i >= frames.length) return;
        const [delay, next] = frames[i++];
        timer = window.setTimeout(() => {
          setFrame(next);
          step();
        }, delay);
      };
      step();
    };

    // A page opened in a background tab has its timers throttled to once a
    // second, so the play-through would crawl unseen and be over by the time
    // the tab is looked at. Wait for the tab instead.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      play();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (document.visibilityState === "visible") play();
        else document.addEventListener("visibilitychange", onVisible);
      },
      // Any visible pixel starts the clock: the lead-in covers the rest of
      // the scroll, and a card whose top sits right at the fold — the
      // desktop layout — must still play.
      { threshold: 0 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-card border border-line bg-surface"
      {...(playing ? { "data-play": "playing" } : {})}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <Eyebrow>You brief it</Eyebrow>
        <span className="text-[12px] text-ink-mute">Example</span>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <dl className="bg-surface p-5">
          {BRIEF.map(([label, value], i) => {
            const typed =
              i < frame.row ? value : i === frame.row ? value.slice(0, frame.chars) : "";
            const active = playing && i === frame.row;
            return (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 py-1.5"
              >
                <dt className="text-[13px] text-ink-mute">{label}</dt>
                <dd className="text-[14px] font-medium text-ink">
                  {/* A non-breaking space keeps the row's height while it's
                      still empty, so the panel never reflows as it types. */}
                  {typed || " "}
                  {active ? <span className="preview-caret" aria-hidden /> : null}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="bg-surface p-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <HostyMark size={18} />
            <span>Hosty</span>
            {frame.thinking ? (
              <span className="preview-thinking font-normal text-ink-mute">
                is typing
                <span className="preview-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            ) : null}
          </div>
          <p
            className="preview-line mt-2 text-[14px] text-ink"
            data-in={frame.tasks > 0 ? "" : undefined}
          >
            Here&rsquo;s your plan for Thursday&rsquo;s mixer:
          </p>

          <ul className="mt-3.5 space-y-1.5">
            {DRAFT_TASKS.map(([when, task], i) => (
              <li
                key={task}
                className="preview-line flex gap-3 text-[14px]"
                data-in={i < frame.tasks ? "" : undefined}
              >
                <span className="w-[92px] shrink-0 tabular-nums text-ink-mute">
                  {when}
                </span>
                <span className="text-ink">{task}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
            {DRAFT_BUDGET.map(([category, amount], i) => (
              <span
                key={category}
                className="preview-line rounded-full border border-line px-3 py-1 text-[13px] text-ink-soft"
                data-in={i < frame.chips ? "" : undefined}
              >
                {category}{" "}
                <span className="tabular-nums font-medium text-ink">{amount}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
