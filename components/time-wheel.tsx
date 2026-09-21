"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";

/**
 * Three drums, the way an alarm clock asks for a time.
 *
 * `input[type=time]` is a keypad problem dressed as a field: a host setting
 * "7 PM" types four characters and a meridiem in an order every browser
 * disagrees about. Spinning to it is one gesture, and the answer is legible
 * from across the room.
 *
 * Submits the same zero-padded 24h `HH:mm` the native input did, through a
 * hidden field, so parseStart never learns about any of this.
 */

const ROW = 32; // h-8, and the only number the scroll maths needs.
const PAD_ROWS = 2; // Half the visible rows above and below, so ends can centre.
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MERIDIEMS = ["AM", "PM"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

type Parsed = { hour: number; minute: number; meridiem: 0 | 1 };

/** "HH:mm" 24h to the three drum positions. 19:00 — the hour a night starts —
 *  stands in for anything blank or unparseable. */
function parse(value: string | undefined): Parsed {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  const h24 = match ? Number(match[1]) : 19;
  const minute = match ? Number(match[2]) : 0;
  if (!(h24 >= 0 && h24 <= 23 && minute >= 0 && minute <= 59)) {
    return { hour: 7, minute: 0, meridiem: 1 };
  }
  return {
    hour: h24 % 12 === 0 ? 12 : h24 % 12,
    minute,
    meridiem: h24 >= 12 ? 1 : 0,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function Drum({
  label,
  rows,
  index,
  onIndex,
}: {
  label: string;
  /** One per row: the digits to show, and the `data-*` pair that names it. */
  rows: Array<{ text: string; attr: Record<string, string> }>;
  index: number;
  onIndex: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Scroll events are the only source of truth for selection, so the drum has
  // to stay deaf until its own opening jump has finished — otherwise the very
  // first settle reports row 0 and eats the default.
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTo({ top: index * ROW, behavior: "instant" });
    const t = setTimeout(() => {
      ready.current = true;
    }, 100);
    return () => clearTimeout(t);
    // Opening position only: later index changes are already scrolled by
    // whatever changed them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = () => {
    const node = ref.current;
    if (!node || !ready.current) return;
    const nearest = Math.min(rows.length - 1, Math.max(0, Math.round(node.scrollTop / ROW)));
    if (nearest !== index) onIndex(nearest);
  };

  const onScroll = () => {
    if (!ready.current) return;
    if ("onscrollend" in window) return; // scrollend below is exact; don't guess.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(settle, 120);
  };

  const scrollToRow = (next: number) => {
    ref.current?.scrollTo({
      top: next * ROW,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    onIndex(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowDown"
        ? Math.min(rows.length - 1, index + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, index - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    scrollToRow(next);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${listId}-${index}`}
      tabIndex={0}
      onScroll={onScroll}
      onScrollEnd={settle}
      onKeyDown={onKeyDown}
      className="h-full flex-1 overflow-y-auto overscroll-contain snap-y snap-mandatory [mask-image:linear-gradient(transparent,black_30%,black_70%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div style={{ height: PAD_ROWS * ROW }} />
      {rows.map((row, i) => (
        <div
          key={row.text}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === index}
          {...row.attr}
          onClick={() => scrollToRow(i)}
          className={cx(
            "flex h-8 cursor-pointer snap-center items-center justify-center text-center text-[17px] tabular",
            i === index ? "text-ink font-medium" : "text-ink-mute",
          )}
        >
          {row.text}
        </div>
      ))}
      <div style={{ height: PAD_ROWS * ROW }} />
    </div>
  );
}

export function TimeWheel({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [{ hour, minute, meridiem }, setTime] = useState<Parsed>(() => parse(defaultValue));

  const h24 = meridiem === 1 ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  const hhmm = `${pad(h24)}:${pad(minute)}`;

  return (
    <div className="w-full max-w-[320px]">
      <input type="hidden" name={name} value={hhmm} />

      <p className="mb-2 text-[14px] font-medium text-ink">
        {hour}:{pad(minute)} {MERIDIEMS[meridiem]}
      </p>

      <div className="relative h-40 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 border-y border-line bg-sunk/60" />
        <div className="relative flex h-full">
          <Drum
            label="Hour"
            rows={HOURS.map((h) => ({ text: String(h), attr: { "data-hour": String(h) } }))}
            index={hour - 1}
            onIndex={(i) => setTime((t) => ({ ...t, hour: HOURS[i] }))}
          />
          <Drum
            label="Minute"
            rows={MINUTES.map((m) => ({ text: pad(m), attr: { "data-minute": String(m) } }))}
            index={minute}
            onIndex={(i) => setTime((t) => ({ ...t, minute: MINUTES[i] }))}
          />
          <Drum
            label="AM or PM"
            rows={MERIDIEMS.map((m) => ({ text: m, attr: { "data-meridiem": m } }))}
            index={meridiem}
            onIndex={(i) => setTime((t) => ({ ...t, meridiem: i === 1 ? 1 : 0 }))}
          />
        </div>
      </div>
    </div>
  );
}
