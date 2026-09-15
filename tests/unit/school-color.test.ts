import { describe, expect, it } from "vitest";
import {
  DARK_GROUND,
  LIGHT_GROUND,
  TARGET_CONTRAST,
  contrast,
  hexToRgb,
  paletteCss,
  paletteFor,
  readableOn,
  rgbToHsl,
  washOn,
} from "@/lib/school-color";
import { SCHOOLS } from "@/lib/schools";

describe("contrast, against the known anchors", () => {
  it("puts black on white at 21 and a colour on itself at 1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#a51c30", "#a51c30")).toBeCloseTo(1, 5);
  });

  it("reads short hex the same as long", () => {
    expect(hexToRgb("#fff")).toEqual(hexToRgb("#ffffff"));
  });
});

describe("making a school colour legible", () => {
  it("leaves a colour alone when it already passes", () => {
    // Harvard crimson is dark enough for paper as published.
    expect(readableOn("#a51c30", LIGHT_GROUND)).toBe("#a51c30");
  });

  it("darkens Columbia's light blue, which is unreadable on paper as given", () => {
    expect(contrast("#b9d9eb", LIGHT_GROUND)).toBeLessThan(TARGET_CONTRAST);
    const fixed = readableOn("#b9d9eb", LIGHT_GROUND);
    expect(contrast(fixed, LIGHT_GROUND)).toBeGreaterThanOrEqual(TARGET_CONTRAST);
  });

  it("lifts Texas A&M maroon, which disappears on a night ground", () => {
    expect(contrast("#500000", DARK_GROUND)).toBeLessThan(TARGET_CONTRAST);
    const fixed = readableOn("#500000", DARK_GROUND);
    expect(contrast(fixed, DARK_GROUND)).toBeGreaterThanOrEqual(TARGET_CONTRAST);
  });

  it("does not turn Texas A&M maroon into a fire engine", () => {
    // Lifting #500000 by lightness alone lands on pure red, which reads as a
    // different school entirely. Saturation has to ease off on the way up.
    const lifted = readableOn("#500000", DARK_GROUND);
    const { s } = rgbToHsl(hexToRgb(lifted));
    expect(s).toBeLessThan(0.75);
    expect(lifted).not.toBe("#f80000");
  });

  it("leaves saturation alone on the way down", () => {
    // Darkening a pale colour concentrates it, which is what you want.
    const before = rgbToHsl(hexToRgb("#b9d9eb"));
    const after = rgbToHsl(hexToRgb(readableOn("#b9d9eb", LIGHT_GROUND)));
    expect(after.s).toBeGreaterThanOrEqual(before.s - 0.02);
  });

  it("keeps the hue, which is what keeps the school recognisable", () => {
    const before = rgbToHsl(hexToRgb("#b9d9eb"));
    const after = rgbToHsl(hexToRgb(readableOn("#b9d9eb", LIGHT_GROUND)));
    expect(Math.abs(after.h - before.h)).toBeLessThan(0.02);
  });
});

describe("every school we ship", () => {
  const withColor = SCHOOLS.filter((s) => s.color);

  it("has a colour for all of them", () => {
    expect(withColor.length).toBe(SCHOOLS.length);
  });

  for (const school of SCHOOLS.filter((s) => s.color)) {
    it(`${school.short} is legible on both grounds`, () => {
      const palette = paletteFor(school.color!);
      expect(contrast(palette.light, LIGHT_GROUND)).toBeGreaterThanOrEqual(TARGET_CONTRAST);
      expect(contrast(palette.dark, DARK_GROUND)).toBeGreaterThanOrEqual(TARGET_CONTRAST);
    });
  }
});

describe("the wash", () => {
  it("stays close to the ground, because it sits behind text", () => {
    const wash = washOn("#a51c30", LIGHT_GROUND);
    expect(contrast(wash, LIGHT_GROUND)).toBeLessThan(1.3);
  });
});

describe("the stylesheet", () => {
  const css = paletteCss(paletteFor("#006747"));

  it("sets both tokens for light", () => {
    expect(css).toContain("--color-brand:");
    expect(css).toContain("--color-brand-wash:");
  });

  it("re-states dark inside a media query, so the light accent cannot leak", () => {
    // globals.css sets its dark tokens in a media query; a flat override here
    // would win in both themes and put a light-ground accent on night.
    expect(css).toContain("@media (prefers-color-scheme:dark)");
    const darkHalf = css.slice(css.indexOf("@media"));
    expect(darkHalf).toContain("--color-brand:");
  });

  it("emits nothing that could break out of a style element", () => {
    for (const school of SCHOOLS.filter((s) => s.color)) {
      expect(paletteCss(paletteFor(school.color!))).not.toContain("<");
    }
  });
});
