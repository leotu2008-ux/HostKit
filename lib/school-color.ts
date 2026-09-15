/**
 * Turns a school's official colour into an accent the app can actually use.
 *
 * Official colours are chosen for flags and jerseys, not for 14px text on a
 * near-white page. Columbia's light blue and Purdue's old gold are close to
 * invisible on paper; Texas A&M's maroon and Brown's brown disappear into a
 * night ground. Using the raw hex either way produces text nobody can read.
 *
 * So the hex is treated as a hue to keep and a lightness to negotiate: hold
 * the hue, walk the lightness until it clears the contrast bar against the
 * ground it will actually sit on. Babson green stays recognisably Babson
 * green; it just stops being unreadable.
 *
 * Pure, no imports, safe on the client.
 */

/** The two grounds from app/globals.css that the accent has to work on. */
export const LIGHT_GROUND = "#f8f8f7";
export const DARK_GROUND = "#0e0e0f";

/** WCAG AA for normal text. The accent carries small labels and links. */
export const TARGET_CONTRAST = 4.5;

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance. */
export function luminance(rgb: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 };
}

/**
 * The same colour, walked away from the ground until it is legible on it: a
 * pale gold darkens on paper, a deep maroon lifts on a night ground.
 *
 * The hue is never touched — that is what keeps a school recognisable.
 * Saturation is held too, except when lifting a very dark colour, where it
 * eases off; see taperedSaturation for why.
 */
export function readableOn(hex: string, ground: string, target = TARGET_CONTRAST): string {
  if (contrast(hex, ground) >= target) return hex.toLowerCase();

  const hsl = rgbToHsl(hexToRgb(hex));
  const groundIsLight = luminance(hexToRgb(ground)) > 0.5;
  const step = groundIsLight ? -0.01 : 0.01;

  let { l } = hsl;
  let best = hex.toLowerCase();
  for (let i = 0; i < 100; i++) {
    l += step;
    if (l <= 0 || l >= 1) break;
    const candidate = rgbToHex(hslToRgb({ h: hsl.h, s: taperedSaturation(hsl, l), l }));
    best = candidate;
    if (contrast(candidate, ground) >= target) return candidate;
  }
  // Ran out of room: the darkest or lightest this hue goes.
  return best;
}

/**
 * Saturation has to come down as a very dark colour is lifted, or the hue
 * stops reading as itself. Texas A&M maroon is the case that proves it:
 * #500000 is fully saturated at 16% lightness, and raising lightness alone
 * lands on pure #f80000 — a fire engine, not a school. Easing saturation
 * toward a mid value keeps it a lighter maroon.
 *
 * Only on the way up. Darkening a pale colour concentrates it, which is what
 * you want, so a colour walked down keeps its saturation.
 */
const TINT_SATURATION = 0.45;
const FULL_TAPER_AT = 0.35;

function taperedSaturation(from: Hsl, to: number): number {
  const lifted = to - from.l;
  if (lifted <= 0 || from.s <= TINT_SATURATION) return from.s;
  const howFar = Math.min(1, lifted / FULL_TAPER_AT);
  return from.s - (from.s - TINT_SATURATION) * howFar;
}

/** A barely-there tint of the accent, for the wash behind hints and chips. */
export function washOn(hex: string, ground: string, amount = 0.09): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(ground);
  return rgbToHex({
    r: b.r + (a.r - b.r) * amount,
    g: b.g + (a.g - b.g) * amount,
    b: b.b + (a.b - b.b) * amount,
  });
}

export type SchoolPalette = {
  /** What the school actually publishes, kept for swatches and credit. */
  source: string;
  light: string;
  lightWash: string;
  dark: string;
  darkWash: string;
};

/** Everything the stylesheet needs for one school, both themes. */
export function paletteFor(hex: string): SchoolPalette {
  return {
    source: hex.toLowerCase(),
    light: readableOn(hex, LIGHT_GROUND),
    lightWash: washOn(hex, LIGHT_GROUND),
    dark: readableOn(hex, DARK_GROUND),
    darkWash: washOn(hex, DARK_GROUND, 0.16),
  };
}

/**
 * The stylesheet itself. It has to beat the tokens in globals.css, which set
 * the dark values inside a media query, so the dark half is re-stated in the
 * same kind of query rather than as a flat override — otherwise a school's
 * light accent would leak onto the night ground.
 */
export function paletteCss(palette: SchoolPalette): string {
  return (
    `:root{--color-brand:${palette.light};--color-brand-wash:${palette.lightWash}}` +
    `@media (prefers-color-scheme:dark){:root{--color-brand:${palette.dark};--color-brand-wash:${palette.darkWash}}}`
  );
}
