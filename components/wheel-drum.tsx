"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";

/**
 * One scroll drum, the way an alarm clock asks for a number.
 *
 * Shared by the start-time wheel (components/time-wheel.tsx) and the duration
 * wheel (components/duration-wheel.tsx): both are the same gesture — spin to
 * the answer, read it from across the room — over different rows. The scroll
 * maths, the `scrollend` fallback, the opening jump and the listbox keyboard
 * all live here once.
 */

export const ROW = 32; // h-8, and the only number the scroll maths needs.
export const PAD_ROWS = 2; // Half the visible rows above and below, so ends can centre.

export type DrumOption = {
  /** What `onChange` reports, and what `value` is matched against. */
  value: string;
  /** The digits on the row. */
  label: string;
  /** The `data-*` pair that names this row to the e2e helpers. */
  data: Record<string, string>;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function Drum({
  label,
  options,
  value,
  onChange,
  disabledValues,
}: {
  label: string;
  options: DrumOption[];
  value: string;
  onChange: (value: string) => void;
  /** Rows that can't be chosen right now — 24 hours leaves no minutes to add.
   *  Shown dimmed, skipped by the arrows, and deaf to a click. */
  disabledValues?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Scroll events are the only source of truth for selection, so the drum has
  // to stay deaf until its own opening jump has finished — otherwise the very
  // first settle reports row 0 and eats the default.
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const isDisabled = (i: number) => disabledValues?.includes(options[i].value) ?? false;

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

  // A value the drum didn't ask for — the owner overruled it, the way 24 hours
  // forces the minutes back to 00 — has to be caught up with physically, since
  // nothing scrolled the rows.
  const mine = useRef(value);
  useEffect(() => {
    if (mine.current === value) return;
    mine.current = value;
    ref.current?.scrollTo({
      top: index * ROW,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [value, index]);

  const emit = (next: number) => {
    mine.current = options[next].value;
    onChange(options[next].value);
  };

  /** The choosable row closest to `from`, itself included. Null only when
   *  every row is disabled, which no caller does. */
  const nearestChoosable = (from: number): number | null => {
    for (let d = 0; d < options.length; d += 1) {
      if (from - d >= 0 && !isDisabled(from - d)) return from - d;
      if (from + d < options.length && !isDisabled(from + d)) return from + d;
    }
    return null;
  };

  const scrollToRow = (next: number) => {
    ref.current?.scrollTo({
      top: next * ROW,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    emit(next);
  };

  const settle = () => {
    const node = ref.current;
    if (!node || !ready.current) return;
    const nearest = Math.min(options.length - 1, Math.max(0, Math.round(node.scrollTop / ROW)));
    // A flick can land where a click and the arrows aren't allowed to go, and
    // only the drum can see that it did — the owner overruling the value it
    // never accepted wouldn't move the rows. Spring back instead.
    const target = nearestChoosable(nearest);
    if (target === null) return;
    if (target !== nearest) {
      scrollToRow(target);
      return;
    }
    if (nearest !== index) emit(nearest);
  };

  const onScroll = () => {
    if (!ready.current) return;
    if ("onscrollend" in window) return; // scrollend below is exact; don't guess.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(settle, 120);
  };

  /** The first choosable row from `from` in `step`'s direction, or null. */
  const seek = (from: number, step: number): number | null => {
    for (let i = from; i >= 0 && i < options.length; i += step) {
      if (!isDisabled(i)) return i;
    }
    return null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowDown"
        ? seek(Math.min(options.length - 1, index + 1), 1)
        : event.key === "ArrowUp"
          ? seek(Math.max(0, index - 1), -1)
          : event.key === "Home"
            ? seek(0, 1)
            : event.key === "End"
              ? seek(options.length - 1, -1)
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
      {options.map((option, i) => (
        <div
          key={option.value}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === index}
          aria-disabled={isDisabled(i) || undefined}
          {...option.data}
          onClick={() => {
            if (!isDisabled(i)) scrollToRow(i);
          }}
          className={cx(
            "flex h-8 cursor-pointer snap-center items-center justify-center text-center text-[17px] tabular",
            i === index ? "text-ink font-medium" : "text-ink-mute",
            isDisabled(i) && "cursor-default opacity-40",
          )}
        >
          {option.label}
        </div>
      ))}
      <div style={{ height: PAD_ROWS * ROW }} />
    </div>
  );
}
