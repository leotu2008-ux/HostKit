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
 * Subtitles wave `by="word"` instead: each word is one lifted span holding
 * the real text, so the sentence is in the page once for screen readers,
 * copy and find-in-page.
 *
 * Each letter starts 28ms after the one before, each word 45ms. A long line
 * tightens that step, so the whole wave still lands within about a second.
 */
const STEP_MS = { letter: 28, word: 45 };
const CSS_STEP_MS = 28;
const LONGEST_WAVE_MS = 1000;

export function WaveText({
  text,
  className,
  by = "letter",
}: {
  text: string;
  className?: string;
  by?: "letter" | "word";
}) {
  let n = 0;
  const words = text.split(" ");
  const units = by === "word" ? words.length : text.replace(/ /g, "").length;
  const base = STEP_MS[by];
  const step = units * base > LONGEST_WAVE_MS ? Math.max(4, Math.floor(LONGEST_WAVE_MS / units)) : base;
  const style = step === CSS_STEP_MS ? undefined : ({ "--wave-step": `${step}ms` } as CSSProperties);
  if (by === "word") {
    return (
      <span className={cx("wave-line", className)} style={style}>
        {words.map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? " " : null}
            <span className="wave-ch" style={{ "--n": w } as CSSProperties}>
              {word}
            </span>
          </Fragment>
        ))}
      </span>
    );
  }
  return (
    <span className={cx("wave-line", className)} style={style}>
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
