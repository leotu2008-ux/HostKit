import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The landing's entrance timing lives in globals.css as motion tokens. These
 * tests resolve the rules that use them into real numbers, so "slower and
 * smoother" stays true when someone tunes a value.
 */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`globals.css has no --${name}`);
  return match[1].trim();
}

/** Replaces var(--x) with its token, recursively. */
function resolve(value: string): string {
  return value.replace(/var\(--([a-z-]+)(?:,[^)]*)?\)/g, (_, name: string) => resolve(token(name)));
}

function seconds(value: string): number {
  const m = value.trim().match(/^([\d.]+)(ms|s)$/);
  if (!m) throw new Error(`not a duration: ${value}`);
  return m[2] === "ms" ? Number(m[1]) / 1000 : Number(m[1]);
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`globals.css has no "${selector}" rule`);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  if (start < 0) throw new Error(`globals.css has no @keyframes ${name}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unbalanced keyframes");
}

describe("landing entrance timing", () => {
  it("rises each hero line slowly, a second or more each", () => {
    const animation = resolve(rule(".rise").match(/animation:\s*([^;]+);/)![1]);
    expect(seconds(animation.split(/\s+/)[1])).toBeGreaterThanOrEqual(1);
  });

  it("spaces the lines out so they arrive one after another, not all at once", () => {
    expect(seconds(resolve(token("landing-stagger")))).toBeGreaterThanOrEqual(0.13);
  });

  it("eases out smoothly, with no overshoot", () => {
    const ease = resolve(token("landing-ease"));
    const points = ease.match(/cubic-bezier\(([^)]+)\)/)![1].split(",").map(Number);
    expect(points).toHaveLength(4);
    // y1 and y2 inside [0, 1]: the motion never passes its target and springs back.
    expect(points[1]).toBeGreaterThanOrEqual(0);
    expect(points[1]).toBeLessThanOrEqual(1);
    expect(points[3]).toBeGreaterThanOrEqual(0);
    expect(points[3]).toBeLessThanOrEqual(1);
  });

  it("floats Hosty in without the springy overshoot, and bobs him slowly", () => {
    const pop = keyframes("hosty-pop");
    const scales = [...pop.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(scales.every((s) => s <= 1)).toBe(true);
    const animation = resolve(rule(".hosty-pop").match(/animation:\s*([^;]+);/)![1]);
    const [popPart, bobPart] = animation.split(/,\s*(?=hosty-bob)/);
    expect(seconds(popPart.trim().split(/\s+/)[1])).toBeGreaterThanOrEqual(1);
    expect(seconds(bobPart.trim().split(/\s+/)[1])).toBeGreaterThanOrEqual(4);
  });

  it("reveals the sections below on the same slow, smooth timing", () => {
    const transition = resolve(rule('.reveal[data-reveal="in"]').match(/transition:\s*([^;]+);/)![1]);
    const durations = [...transition.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((m) => seconds(m[0]));
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(1);
  });
});
