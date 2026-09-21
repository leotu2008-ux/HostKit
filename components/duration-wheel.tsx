"use client";

import { useState } from "react";
import { Drum } from "@/components/wheel-drum";
import { formatDuration } from "@/lib/when";

/**
 * Two drums for how long the night runs.
 *
 * The number input this replaces only took whole hours, so an hour-and-a-half
 * dinner had to be called one or two — and hourly venue pricing, which
 * multiplies this, was wrong by a whole hour either way. Quarter hours are as
 * fine as any host has asked for; the drums make the step the only step,
 * so there is nothing to validate on the way in.
 *
 * Submits the same single number the field always did, fractional now
 * ("1.5", "0.25"), through a hidden field.
 */

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24
const MINUTES = [0, 15, 30, 45];
const QUARTER = 15;
/** Below a quarter hour isn't a duration, and past a day isn't a night. */
const MIN_QUARTERS = 1;
const MAX_QUARTERS = 24 * 4;
/** The old field's most common answer, and what a blank event opens on. */
const DEFAULT_QUARTERS = 16;

const pad = (n: number) => String(n).padStart(2, "0");

/** Fractional hours to the two drum positions, snapped to the step the drums
 *  can actually show. Anything unset or out of range opens on four hours. */
function parse(value: number | undefined): { hours: number; minutes: number } {
  const quarters =
    value !== undefined && Number.isFinite(value)
      ? Math.min(MAX_QUARTERS, Math.max(MIN_QUARTERS, Math.round(value * 4)))
      : DEFAULT_QUARTERS;
  return { hours: Math.floor(quarters / 4), minutes: (quarters % 4) * QUARTER };
}

export function DurationWheel({ name, defaultValue }: { name: string; defaultValue?: number }) {
  const [{ hours, minutes }, setLength] = useState(() => parse(defaultValue));

  // Quarter hours are exact in binary (0.25, 0.5, 0.75), so this is the "1.5"
  // the action reads back, not 1.4999999999.
  const total = hours + minutes / 60;

  // The two ends of the drum pair rule each other out: a full day has no
  // minutes left to add, and no hours at all still has to last a quarter of
  // one. Both drums show the ruled-out rows dimmed rather than dropping them,
  // so the pair doesn't change length under the host's thumb.
  const lockedMinutes =
    hours === 24
      ? MINUTES.filter((m) => m !== 0).map(String)
      : hours === 0
        ? ["0"]
        : undefined;

  return (
    <div className="w-full max-w-[320px]">
      <input type="hidden" name={name} value={String(total)} />

      <p className="mb-2 text-[14px] font-medium text-ink">{formatDuration(total)}</p>

      <div className="relative h-40 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 border-y border-line bg-sunk/60" />
        <div className="relative flex h-full">
          <div className="flex h-full flex-1 items-center">
            <Drum
              label="Hours"
              options={HOURS.map((h) => ({
                value: String(h),
                label: String(h),
                data: { "data-duration-hour": String(h) },
              }))}
              value={String(hours)}
              onChange={(next) =>
                setLength(({ minutes: m }) => {
                  const h = Number(next);
                  if (h === 24) return { hours: h, minutes: 0 };
                  if (h === 0 && m === 0) return { hours: h, minutes: QUARTER };
                  return { hours: h, minutes: m };
                })
              }
            />
            <span className="w-8 text-[13px] text-ink-mute">hr</span>
          </div>
          <div className="flex h-full flex-1 items-center">
            <Drum
              label="Minutes"
              options={MINUTES.map((m) => ({
                value: String(m),
                label: pad(m),
                data: { "data-duration-minute": String(m) },
              }))}
              value={String(minutes)}
              disabledValues={lockedMinutes}
              onChange={(next) =>
                setLength(({ hours: h }) => {
                  const m = Number(next);
                  if (h === 24) return { hours: h, minutes: 0 };
                  if (h === 0 && m === 0) return { hours: h, minutes: QUARTER };
                  return { hours: h, minutes: m };
                })
              }
            />
            <span className="w-8 text-[13px] text-ink-mute">min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
