import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The signed-in app's blue palette lives in one CSS block. These tests read
 * the stylesheet itself, so a hand-tuned hex that drops below WCAG AA fails
 * here rather than in someone's eyes.
 */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** The `--color-*` declarations in the first block opened by `opener`. */
function tokens(opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`globals.css has no "${opener}" block`);
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries(
    [...body.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const base = tokens("@theme {");
const override = tokens("html:has(.theme-app) {");
const app = { ...base, ...override };

describe("signed-in app theme", () => {
  it("leaves the public pages' theme alone", () => {
    expect(base.clay).toBe("#141414");
    expect(base.paper).toBe("#f8f8f7");
    expect(base["ink-mute"]).toBe("#8b8884");
  });

  it("makes the accent blue", () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(app.clay.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r + 80);
    expect(b).toBeGreaterThan(g + 80);
  });

  const grounds = ["surface", "paper", "sunk"] as const;
  const texts = ["ink", "ink-soft", "ink-mute", "clay", "clay-deep", "forest", "amber", "danger"] as const;

  for (const text of texts) {
    for (const ground of grounds) {
      it(`${text} on ${ground} reaches 4.5:1`, () => {
        expect(contrast(app[text], app[ground])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // The washes (clay-wash, brand-wash) are also text-bearing grounds — see
  // app/(workspace)/events/[id]/page.tsx's brand-wash card — so ink,
  // ink-soft and ink-mute must clear AA on them too, not just on surface,
  // paper and sunk.
  const washTexts = ["ink", "ink-soft", "ink-mute"] as const;
  const washGrounds = ["clay-wash", "brand-wash"] as const;

  for (const text of washTexts) {
    for (const ground of washGrounds) {
      it(`${text} on ${ground} reaches 4.5:1`, () => {
        expect(contrast(app[text], app[ground])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it.each([
    ["on-clay", "clay"],
    ["on-clay", "clay-deep"],
    ["clay-deep", "clay-wash"],
    ["brand", "brand-wash"],
  ])("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(contrast(app[fg], app[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
