"use client";

import { useState } from "react";
import { Drum } from "@/components/wheel-drum";
import {
  applyDurationRules,
  DEFAULT_DURATION_HOURS,
  hoursToInputValue,
  joinHours,
  MAX_DURATION_HOURS,
  MINUTE_STEPS,
  ruledOutMinutes,
  splitHours,
  type DurationMinutes,
} from "@/lib/duration";
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
 * Every rule about what a duration may be lives in lib/duration.ts, which the
 * brief action and the iOS create route share — this file only spins.
 *
 * Submits the same single number the field always did, fractional now
 * ("1.5", "0.25"), through a hidden field.
 */

const HOURS = Array.from({ length: MAX_DURATION_HOURS + 1 }, (_, i) => i); // 0–24

const pad = (n: number) => String(n).padStart(2, "0");

export function DurationWheel({ name, defaultValue }: { name: string; defaultValue?: number }) {
  const [{ h, m }, setLength] = useState(() =>
    splitHours(defaultValue ?? DEFAULT_DURATION_HOURS),
  );

  const total = joinHours(h, m);
  // Both drums keep their full length so the pair doesn't change size under
  // the host's thumb; the rows the rules refuse just go dim.
  const locked = ruledOutMinutes(h).map(String);

  return (
    <div className="w-full max-w-[320px]">
      <input type="hidden" name={name} value={hoursToInputValue(total)} />

      <p className="mb-2 text-[14px] font-medium text-ink">{formatDuration(total)}</p>

      <div className="relative h-40 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 border-y border-line bg-sunk/60" />
        <div className="relative flex h-full">
          <div className="flex h-full flex-1 items-center">
            <Drum
              label="Hours"
              options={HOURS.map((hour) => ({
                value: String(hour),
                label: String(hour),
                data: { "data-duration-hour": String(hour) },
              }))}
              value={String(h)}
              onChange={(next) =>
                setLength((current) => applyDurationRules(Number(next), current.m))
              }
            />
            <span className="w-8 text-[13px] text-ink-mute">hr</span>
          </div>
          <div className="flex h-full flex-1 items-center">
            <Drum
              label="Minutes"
              options={MINUTE_STEPS.map((minute) => ({
                value: String(minute),
                label: pad(minute),
                data: { "data-duration-minute": String(minute) },
              }))}
              value={String(m)}
              disabledValues={locked.length > 0 ? locked : undefined}
              onChange={(next) =>
                setLength((current) =>
                  applyDurationRules(current.h, Number(next) as DurationMinutes),
                )
              }
            />
            <span className="w-8 text-[13px] text-ink-mute">min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
