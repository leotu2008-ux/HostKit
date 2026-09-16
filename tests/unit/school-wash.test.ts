import { describe, expect, it } from "vitest";
import {
  DARK_GROUND,
  LIGHT_GROUND,
  MIN_TINT,
  WASH_MIX,
  mixOver,
  tintStrength,
  washCss,
  washFor,
  washPaletteFor,
} from "@/lib/school-wash";
import { SCHOOLS } from "@/lib/schools";

/** What the app has always used, and the reason MIN_TINT is where it is. */
const BRAND_LIGHT = "#c64a22";
const BRAND_DARK = "#e5643a";

describe("the bar is the design's own wash", () => {
  it("today's brand orange already clears it on both grounds", () => {
    expect(tintStrength(BRAND_LIGHT, LIGHT_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
    expect(tintStrength(BRAND_DARK, DARK_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
  });

  it("mixes at the same 10% the CSS does", () => {
    expect(WASH_MIX).toBe(0.1);
    // Mixing nothing leaves the ground; mixing everything gives the colour.
    expect(mixOver("#006747", LIGHT_GROUND, 0)).toBe(LIGHT_GROUND);
    expect(mixOver("#006747", LIGHT_GROUND, 1)).toBe("#006747");
  });
});

describe("colours that were too faint to see", () => {
  it("Columbia's light blue barely tints paper as published", () => {
    expect(tintStrength("#b9d9eb", LIGHT_GROUND)).toBeLessThan(MIN_TINT);
    expect(tintStrength(washFor("#b9d9eb", LIGHT_GROUND), LIGHT_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
  });

  it("Texas A&M's maroon is all but invisible on the night ground", () => {
    expect(tintStrength("#500000", DARK_GROUND)).toBeLessThan(MIN_TINT);
    expect(tintStrength(washFor("#500000", DARK_GROUND), DARK_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
  });

  it("leaves a colour alone when it already shows", () => {
    // Babson green tints paper more strongly than the brand orange does.
    expect(washFor("#006747", LIGHT_GROUND)).toBe("#006747");
  });
});

describe("every school we ship", () => {
  for (const school of SCHOOLS.filter((s) => s.color)) {
    it(`${school.short} tints both grounds visibly`, () => {
      const wash = washPaletteFor(school.color!);
      expect(tintStrength(wash.light, LIGHT_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
      expect(tintStrength(wash.dark, DARK_GROUND)).toBeGreaterThanOrEqual(MIN_TINT);
    });
  }
});

describe("the stylesheet", () => {
  const css = washCss(washPaletteFor("#006747"));

  it("touches the wash and nothing else", () => {
    expect(css).toContain("--color-wash:");
    // The whole point of option 2: links and buttons keep the app's accent.
    expect(css).not.toContain("--color-brand");
  });

  it("re-states dark in its own media query, so the light wash cannot leak", () => {
    expect(css).toContain("@media (prefers-color-scheme:dark)");
    expect(css.slice(css.indexOf("@media"))).toContain("--color-wash:");
  });

  it("emits nothing that could escape a style element", () => {
    for (const school of SCHOOLS.filter((s) => s.color)) {
      const out = washCss(washPaletteFor(school.color!));
      expect(out).not.toContain("<");
      expect(out).not.toContain(";}" + "</style>");
    }
  });
});
