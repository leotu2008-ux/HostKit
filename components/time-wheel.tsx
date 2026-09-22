"use client";

import { useState } from "react";
import { Drum } from "@/components/wheel-drum";

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
            options={HOURS.map((h) => ({
              value: String(h),
              label: String(h),
              data: { "data-hour": String(h) },
            }))}
            value={String(hour)}
            onChange={(next) => setTime((t) => ({ ...t, hour: Number(next) }))}
          />
          <Drum
            label="Minute"
            options={MINUTES.map((m) => ({
              value: String(m),
              label: pad(m),
              data: { "data-minute": String(m) },
            }))}
            value={String(minute)}
            onChange={(next) => setTime((t) => ({ ...t, minute: Number(next) }))}
          />
          <Drum
            label="AM or PM"
            options={MERIDIEMS.map((m) => ({ value: m, label: m, data: { "data-meridiem": m } }))}
            value={MERIDIEMS[meridiem]}
            onChange={(next) => setTime((t) => ({ ...t, meridiem: next === "PM" ? 1 : 0 }))}
          />
        </div>
      </div>
    </div>
  );
}
