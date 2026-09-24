import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GHOST_EYES, glyphCells, pointInGhost } from "@/lib/hosty-glyphs";
import { HostyGlyphs } from "@/components/hosty-glyphs";
import { WaveText } from "@/components/wave-text";
import { HeroHeadline } from "@/components/hero-headline";

const inEye = (x: number, y: number) =>
  GHOST_EYES.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);

describe("Hosty's outline as a shape", () => {
  it("contains his body and speech tail, and nothing far outside", () => {
    expect(pointInGhost(50, 65)).toBe(true); // belly
    expect(pointInGhost(50, 30)).toBe(true); // head
    expect(pointInGhost(20, 88)).toBe(true); // tail
    expect(pointInGhost(5, 5)).toBe(false);
    expect(pointInGhost(95, 50)).toBe(false);
    expect(pointInGhost(50, 99)).toBe(false);
  });
});

describe("glyphCells", () => {
  const cells = glyphCells(5.6);

  it("fills his shape with a grid of character cells", () => {
    expect(cells.length).toBeGreaterThan(40);
    expect(cells.every((c) => pointInGhost(c.x, c.y))).toBe(true);
  });

  it("cuts his eyes out, so they read as holes in the texture", () => {
    expect(cells.some((c) => inEye(c.x, c.y))).toBe(false);
  });

  it("keeps the speech tail, so it's still Hosty in characters", () => {
    expect(cells.some((c) => c.x < 24 && c.y > 84)).toBe(true);
  });

  it("marks the cells along his outline so they can be drawn solid", () => {
    expect(cells.some((c) => c.edge)).toBe(true);
    expect(cells.some((c) => !c.edge)).toBe(true);
  });

  it("gets denser as the step gets smaller", () => {
    expect(glyphCells(4).length).toBeGreaterThan(glyphCells(6).length);
  });
});

describe("HostyGlyphs", () => {
  it("draws his outline, with a character canvas ready behind it, all hidden from screen readers", () => {
    const html = renderToStaticMarkup(createElement(HostyGlyphs, { active: false }));
    expect(html).toContain('viewBox="0 0 100 100"');
    expect(html).toContain("<canvas");
    expect(html).toMatch(/<span[^>]*aria-hidden="true"/);
  });
});

describe("WaveText", () => {
  it("keeps the words readable to screen readers and splits the letters for the wave", () => {
    const html = renderToStaticMarkup(createElement(WaveText, { text: "the work." }));
    expect(html).toContain('<span class="sr-only">the work.</span>');
    // One span per letter (spaces stay plain text, so lines still wrap between words)…
    expect(html.match(/class="wave-ch"/g)?.length).toBe("thework.".length);
    expect(html).toContain('style="--n:0"');
    expect(html).toContain('style="--n:7"');
  });

  it("keeps each word whole, so a phone never breaks a line mid-word", () => {
    const html = renderToStaticMarkup(createElement(WaveText, { text: "Let the agent do" }));
    expect(html.match(/class="wave-word"/g)?.length).toBe(4);
    expect(html).toMatch(/<\/span> <span class="wave-word">/);
  });
});

describe("HeroHeadline", () => {
  const html = renderToStaticMarkup(createElement(HeroHeadline));

  it("says the same words as before", () => {
    expect(html).toContain('<span class="sr-only">Plan the event.</span>');
    expect(html).toContain('<span class="sr-only">Let the agent do</span>');
    expect(html).toContain('<span class="sr-only">the work.</span>');
  });

  it("waves each line on its own and puts a bigger Hosty beside \"the work.\"", () => {
    expect(html.match(/class="wave-line/g)?.length).toBe(3);
    expect(html).toContain("hosty-glyphs");
    expect(html).toContain("hosty-pop");
  });

});
