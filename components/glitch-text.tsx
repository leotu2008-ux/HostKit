"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text that scrambles into characters on hover, then resolves.
 *
 * Modelled on coreatcu.com, which draws its logo as a grid of monospace
 * glyphs and randomly re-tints and re-rolls individual cells. That version is
 * a canvas rasterising letterforms into a character grid; this is the same
 * idea applied to live text — each letter rolls through the set below and
 * locks in left to right.
 *
 * Two things this must not break, in order of importance.
 *
 * **What a screen reader hears.** The scramble lives in an aria-hidden layer
 * and the real string sits beside it in an sr-only span, so assistive tech
 * reads "Simplifying events." however mangled the pixels look.
 *
 * **Layout.** The glyphs are proportional, so a scrambled string is wider than
 * the real one and the heading re-wraps under the cursor — "Simplifying
 * events." broke onto two lines and shoved the page down. Pinning the width
 * does not fix it, because the text still re-wraps inside that width. So the
 * real string stays in the box, merely invisible, and the scramble is painted
 * over it absolutely: the box is defined by text that never changes, and
 * nothing can move. The overlay clips only the extra width; it is taller than
 * the line box so descenders (the g in "agent") are not cut off.
 */

/** The set a rolling cell can land on — CORE's own alphabet, plus the
 *  punctuation that reads as machine noise at a glance. */
const ROLL = "CORE{}[]<>/\\0123456789#%&*+=";

/** Frame time. Fast enough to read as noise, slow enough to see glyphs. */
const FRAME_MS = 45;
/** Frames a character rolls before its real value locks in. */
const ROLLS_PER_CHAR = 2;

function randomGlyph(): string {
  return ROLL[Math.floor(Math.random() * ROLL.length)];
}

export function GlitchText({
  children,
  className,
  as: Tag = "span",
}: {
  children: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3";
}) {
  const [display, setDisplay] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setDisplay(null);
  }, []);

  // Cancels a running scramble when the text changes or the component goes
  // away, so a stale interval can't keep rolling the previous string. This is
  // the cleanup rather than the effect body on purpose: setting state
  // synchronously inside an effect cascades renders.
  useEffect(() => stop, [children, stop]);

  const start = useCallback(() => {
    if (timer.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    timer.current = setInterval(() => {
      frame += 1;
      const locked = Math.floor(frame / ROLLS_PER_CHAR);

      if (locked >= children.length) {
        stop();
        return;
      }

      setDisplay(
        children
          .split("")
          .map((char, i) => {
            if (i < locked) return char;
            // Whitespace stays whitespace: rolling it turns one word into a
            // wall and destroys the shape of the line.
            return char.trim() === "" ? char : randomGlyph();
          })
          .join(""),
      );
    }, FRAME_MS);
  }, [children, stop]);

  return (
    <Tag className={className}>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden
        onMouseEnter={start}
        onMouseLeave={stop}
        className="relative inline-block"
      >
        {/* Always present, so the box never changes size. Hidden — not
            removed — while the scramble paints over it. */}
        <span className={display === null ? undefined : "invisible"}>
          {children}
        </span>
        {display === null ? null : (
          // Wider scramble glyphs must not wrap, so we clip horizontally. Do
          // not use inset-0 + overflow-hidden: the heading's 1.04 line-height
          // is shorter than a descender, and the g in "agent" gets cut off.
          <span className="absolute top-0 right-0 left-0 overflow-hidden whitespace-pre pb-[0.3em]">
            {display}
          </span>
        )}
      </span>
    </Tag>
  );
}
