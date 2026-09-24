import { Fragment, type CSSProperties } from "react";
import { cx } from "@/components/ui";

/**
 * A line of headline text whose letters rise one after another on hover
 * (`.wave-line` / `.wave-ch` in globals.css). The letters never change: the
 * real words sit in an sr-only span for screen readers, and the animated
 * copy is aria-hidden.
 *
 * Letters are grouped into unbreakable words with plain spaces between them.
 * One inline-block per letter would otherwise let a phone break a line in
 * the middle of a word.
 *
 * Each letter starts 28ms after the one before. A long subtitle tightens
 * that step, so the whole wave still lands within about a second.
 */
const STEP_MS = 28;
const LONGEST_WAVE_MS = 1000;

export function WaveText({ text, className }: { text: string; className?: string }) {
  let n = 0;
  const words = text.split(" ");
  const letters = text.replace(/ /g, "").length;
  const step = letters * STEP_MS > LONGEST_WAVE_MS ? Math.max(4, Math.floor(LONGEST_WAVE_MS / letters)) : STEP_MS;
  return (
    <span
      className={cx("wave-line", className)}
      style={step === STEP_MS ? undefined : ({ "--wave-step": `${step}ms` } as CSSProperties)}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? " " : null}
            <span className="wave-word">
              {[...word].map((ch) => {
                const i = n++;
                return (
                  <span key={i} className="wave-ch" style={{ "--n": i } as CSSProperties}>
                    {ch}
                  </span>
                );
              })}
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}
