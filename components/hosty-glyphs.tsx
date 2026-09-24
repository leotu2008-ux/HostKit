"use client";

import { useEffect, useMemo, useRef } from "react";
import { HostyMark } from "@/components/hosty-mark";
import { cx } from "@/components/ui";
import { glyphCells } from "@/lib/hosty-glyphs";

/**
 * Hosty, who dissolves into shifting characters while `active` (the landing
 * headline is hovered) and comes back as his outline when it isn't. The
 * characters fill his own shape with his eyes cut out, in ink with a slow
 * wave of the brand blue drifting through — the outline and the canvas
 * cross-fade in CSS (`.hosty-glyphs` in globals.css).
 *
 * The canvas only animates while active, at about 12 frames a second: a
 * flicker, not a blur. Under reduced motion it never starts and CSS keeps
 * the outline showing.
 */

const GLYPHS = ["%", "#", "*", "@", "+", "="];
const STEP = 5.6;
const CANVAS = 400;
const FRAME_MS = 80;

export function HostyGlyphs({ active, className }: { active: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cells = useMemo(() => glyphCells(STEP).map((c) => ({ ...c, glyph: GLYPHS[0] })), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const styles = getComputedStyle(canvas);
    const ink = styles.color;
    const blue = getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim() || "#1d4ed8";
    const scale = CANVAS / 100;
    let raf = 0;
    let last = 0;
    let tick = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      tick += 1;
      ctx.clearRect(0, 0, CANVAS, CANVAS);
      ctx.font = `600 ${STEP * scale * 0.95}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const cell of cells) {
        if (Math.random() < 0.15) cell.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const wave = Math.sin((cell.x + cell.y) / 11 - tick / 3);
        ctx.fillStyle = !cell.edge && wave > 0.3 ? blue : ink;
        ctx.globalAlpha = cell.edge ? 1 : 0.5 + 0.5 * Math.abs(wave);
        ctx.fillText(cell.glyph, cell.x * scale, cell.y * scale);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, cells]);

  return (
    <span aria-hidden="true" className={cx("hosty-glyphs", className)} data-active={active ? "" : undefined}>
      <HostyMark filled className="hosty-glyphs-outline" />
      <canvas ref={canvasRef} width={CANVAS} height={CANVAS} className="hosty-glyphs-canvas" />
    </span>
  );
}
