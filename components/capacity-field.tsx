"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

const compact =
  "min-h-10 rounded-lg border border-line bg-sunk px-3 text-[15px] text-ink focus:border-clay focus:outline-none";

/** Capacity: type a number, or nudge it with − and +. Used by the Brief tab
 *  (components/brief-form.tsx), which passes `min={0}` and
 *  `required={false}` — a blank event's guest count is genuinely unset, not
 *  "at least one person", so 0 renders as an empty field there. */
export function CapacityField({
  name,
  defaultValue,
  min = 1,
  required = true,
}: {
  name: string;
  defaultValue: number;
  min?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const clamp = (n: number) => Math.min(100_000, Math.max(min, n));
  const bump = (delta: number) => setValue((v) => clamp((Number.isFinite(v) ? v : 0) + delta));
  const bumpClass =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink hover:border-line-strong disabled:opacity-40";

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => bump(-1)} aria-label="Fewer" className={bumpClass} disabled={value <= min}>
        −
      </button>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={100000}
        required={required}
        // Empty rather than "0" only when 0 is actually the unset state
        // (min={0}, the Brief tab's usage) — a min={1} caller never
        // legitimately reaches 0, so this never fires there.
        value={Number.isFinite(value) && !(value === 0 && min === 0) ? value : ""}
        onChange={(e) => setValue(e.target.value === "" ? NaN : Number(e.target.value))}
        onBlur={() => setValue((v) => clamp(Number.isFinite(v) ? v : defaultValue))}
        aria-label="Capacity"
        className={cx(compact, "w-24 text-center")}
      />
      <button type="button" onClick={() => bump(1)} aria-label="More" className={bumpClass}>
        +
      </button>
    </div>
  );
}
