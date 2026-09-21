"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";

/**
 * A month grid, in place of `input[type=date]`.
 *
 * The native control reads back differently in every browser and hides the
 * one thing a host planning a night actually wants to see — which day of the
 * week it lands on. This shows the month, so "the 14th" and "that Saturday"
 * are the same glance.
 *
 * Submits the same `YYYY-MM-DD` (or empty) the native input did, through a
 * hidden field, so lib/actions/brief.ts's parseStart is untouched.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const ROWS = 6;

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` for a local Date. */
function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local Date a `YYYY-MM-DD` names, or null. Built field by field on
 *  purpose: `new Date("2026-09-29")` is UTC midnight, which is the day before
 *  in every zone west of Greenwich. */
function fromKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

type Month = { year: number; month: number };

function monthOf(date: Date): Month {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function shiftMonth({ year, month }: Month, delta: number): Month {
  const shifted = new Date(year, month + delta, 1);
  return monthOf(shifted);
}

/** The 42 days a six-row Monday-first grid shows for a month. */
function gridDays({ year, month }: Month): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Sunday is 0; Monday leads here.
  return Array.from({ length: ROWS * 7 }, (_, i) => new Date(year, month, 1 - offset + i));
}

/** Today, as the client sees it. Nothing to subscribe to — the page is not
 *  going to be open across midnight often enough to matter, and a re-render
 *  picks the new day up anyway. */
function subscribeNothing() {
  return () => {};
}

function readToday(): string {
  return toKey(new Date());
}

function readNoToday(): string {
  return "";
}

function inWords(key: string): string {
  const date = fromKey(key);
  if (!date) return "Pick a date";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={back ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
    </svg>
  );
}

export function CalendarPicker({
  name,
  defaultValue,
  onChange,
  describedBy,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** An element describing this date, announced with the grid — the Brief
   *  tab's campus-conflict note, which the native input used to carry as
   *  aria-describedby. */
  describedBy?: string;
}) {
  const initial = defaultValue && fromKey(defaultValue) ? defaultValue : "";
  const [value, setValue] = useState(initial);
  // Both null until the host moves something: the visible month and the
  // roving cell are otherwise *derived* from the date set, or from today.
  const [monthPick, setMonthPick] = useState<Month | null>(null);
  const [focusPick, setFocusPick] = useState<string | null>(null);
  // Only pull focus once the host is actually driving the grid from the
  // keyboard — an effect that focused on mount would steal it from the field
  // above every time this page rendered.
  const grabFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // "" on the server, which can be an hour ahead of the host's own midnight
  // and so a different month; the real answer arrives at hydration without a
  // mismatch and without an effect (the idiom components/install-prompt.tsx
  // uses for the same reason).
  const today = useSyncExternalStore(subscribeNothing, readToday, readNoToday);

  const anchor = fromKey(value) ?? fromKey(today);
  const month = monthPick ?? (anchor ? monthOf(anchor) : null);
  const focusKey = focusPick ?? (value || today);

  useEffect(() => {
    if (!grabFocus.current) return;
    grabFocus.current = false;
    const cell = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`);
    cell?.focus();
  }, [focusKey, month]);

  const commit = (next: string) => {
    setValue(next);
    if (next) {
      setFocusPick(next);
      setMonthPick(null);
    }
    onChange?.(next);
  };

  /** Move the roving cell, dragging the visible month along when it leaves. */
  const focusDate = (to: Date) => {
    grabFocus.current = true;
    setFocusPick(toKey(to));
    setMonthPick(monthOf(to));
  };

  const moveFocus = (deltaDays: number) => {
    const from = fromKey(focusKey) ?? new Date();
    focusDate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + deltaDays));
  };

  const jumpMonth = (delta: number) => {
    const from = fromKey(focusKey) ?? new Date();
    // Clamped to the target month's own length: 31 March a month back would
    // otherwise roll over to 3 March and look like a bug.
    const target = new Date(from.getFullYear(), from.getMonth() + delta, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    focusDate(new Date(target.getFullYear(), target.getMonth(), Math.min(from.getDate(), lastDay)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      moveFocus(moves[event.key]);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      jumpMonth(event.key === "PageUp" ? -1 : 1);
    }
  };

  const days = month ? gridDays(month) : [];
  // Paging the month with the chevrons can leave the roving cell off-grid;
  // the 1st then holds the single tabstop, so the grid is never untabbable.
  const onGrid = days.some((day) => toKey(day) === focusKey);
  const rovingKey =
    onGrid || !month ? focusKey : toKey(new Date(month.year, month.month, 1));
  const label = month
    ? new Date(month.year, month.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";
  const navClass =
    "flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-sunk hover:text-ink";

  return (
    <div className="w-full max-w-[320px]">
      <input type="hidden" name={name} value={value} />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cx("text-[14px]", value ? "font-medium text-ink" : "text-ink-mute")}>
          {inWords(value)}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => commit("")}
            className="text-[13px] text-ink-mute underline decoration-line-strong hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-surface p-2">
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => month && setMonthPick(shiftMonth(month, -1))}
            className={navClass}
          >
            <Chevron back />
          </button>
          <span className="text-[14px] font-medium text-ink">{label}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthPick(monthOf(new Date()))}
              className="rounded-lg px-2 py-1 text-[13px] text-ink-soft hover:bg-sunk hover:text-ink"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => month && setMonthPick(shiftMonth(month, 1))}
              className={navClass}
            >
              <Chevron />
            </button>
          </div>
        </div>

        <div
          role="grid"
          aria-label="Choose a date"
          aria-describedby={describedBy}
          onKeyDown={onKeyDown}
          ref={gridRef}
        >
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                role="columnheader"
                aria-label={day}
                className="flex h-8 items-center justify-center text-[11px] font-medium text-ink-mute"
              >
                {day.slice(0, 2)}
              </span>
            ))}
          </div>
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} role="row" className="grid grid-cols-7">
              {days.slice(row * 7, row * 7 + 7).map((day) => {
                const key = toKey(day);
                const outside = month !== null && day.getMonth() !== month.month;
                const selected = key === value;
                const isToday = key === today;
                // Past nights are allowed: hosts write up the night they
                // already threw. Dimmed, never disabled.
                const past = today !== "" && key < today;
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    data-date={key}
                    aria-selected={selected}
                    aria-current={isToday ? "date" : undefined}
                    tabIndex={key === rovingKey ? 0 : -1}
                    onClick={() => commit(key)}
                    className={cx(
                      "flex h-9 items-center justify-center rounded-lg text-[14px] tabular",
                      selected
                        ? "bg-ink text-paper"
                        : outside
                          ? "text-ink-mute/60 hover:bg-sunk"
                          : past
                            ? "text-ink-mute hover:bg-sunk"
                            : "text-ink hover:bg-sunk",
                      isToday && !selected && "ring-1 ring-ink",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
