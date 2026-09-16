/**
 * The page wash, tinted to the student's school.
 *
 * Three pages (home, Discover, a club) lay a pair of soft radial gradients
 * across the top. Both stops are mixed from CSS variables rather than fixed
 * hexes, so tinting them is a matter of setting one variable — this module
 * works out what to set it to.
 *
 * Deliberately separate from the accent. The accent carries small text and
 * has to clear a contrast threshold to stay legible; a wash sits at 10%
 * behind content and carries nothing, so the only question is whether you
 * can see it at all. That is a far lower bar and a far simpler calculation.
 *
 * Pure, no imports, safe on the client.
 */

export const LIGHT_GROUND = "#f8f8f7";
export const DARK_GROUND = "#0e0e0f";

/** The mix in the gradient declaration: `color-mix(... 10%, transparent)`. */
export const WASH_MIX = 0.1;

/**
 * How visible the wash has to be, as the contrast between the mixed result
 * and the bare ground.
 *
 * Not plucked from the air: today's brand orange lands at 1.140 on paper and
 * 1.109 on the night ground, so this is the weakest wash the design already
 * ships and calls visible. Columbia's light blue manages 1.031 and Texas
 * A&M's maroon 1.007, which is why they need moving at all.
 *
 * Set just under the measured floor rather than at it. A threshold equal to
 * a measured value is a coin flip on rounding, and the first version of this
 * failed its own benchmark by a thousandth.
 */
export const MIN_TINT = 1.1;

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export function hexToRgb(hex: string): Rgb {
  const c = hex.replace("#", "").trim();
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
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

function luminance({ r, g, b }: Rgb): number {
  const ch = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** What the browser will actually paint: `amount` of colour over the ground. */
export function mixOver(hex: string, ground: string, amount = WASH_MIX): string {
  const a = hexToRgb(hex);
  const g = hexToRgb(ground);
  return rgbToHex({
    r: g.r + (a.r - g.r) * amount,
    g: g.g + (a.g - g.g) * amount,
    b: g.b + (a.b - g.b) * amount,
  });
}

/** How strongly a colour tints the ground once mixed. 1 is invisible. */
export function tintStrength(hex: string, ground: string, amount = WASH_MIX): number {
  return contrast(mixOver(hex, ground, amount), ground);
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr
      ? ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
      : max === gg
        ? ((bb - rr) / d + 2) / 6
        : ((rr - gg) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: ch(h + 1 / 3) * 255, g: ch(h) * 255, b: ch(h - 1 / 3) * 255 };
}

/**
 * The colour to hand the gradient so its tint is actually visible: the same
 * hue, walked away from the ground until the mixed result clears MIN_TINT.
 * A colour that already shows is returned untouched.
 */
export function washFor(hex: string, ground: string, minTint = MIN_TINT): string {
  if (tintStrength(hex, ground) >= minTint) return hex.toLowerCase();

  const hsl = rgbToHsl(hexToRgb(hex));
  const groundIsLight = luminance(hexToRgb(ground)) > 0.5;
  const step = groundIsLight ? -0.01 : 0.01;

  let { l } = hsl;
  let best = hex.toLowerCase();
  for (let i = 0; i < 100; i++) {
    l += step;
    if (l <= 0 || l >= 1) break;
    const candidate = rgbToHex(hslToRgb({ ...hsl, l }));
    best = candidate;
    if (tintStrength(candidate, ground) >= minTint) return candidate;
  }
  return best;
}

export type Wash = { source: string; light: string; dark: string };

export function washPaletteFor(hex: string): Wash {
  return {
    source: hex.toLowerCase(),
    light: washFor(hex, LIGHT_GROUND),
    dark: washFor(hex, DARK_GROUND),
  };
}

/**
 * Overrides one variable and nothing else, so links, buttons and hints keep
 * the accent the app was designed with.
 *
 * The dark half is re-stated inside its own media query because globals.css
 * defines its dark tokens that way. A flat `:root` override would win in both
 * themes and drop a paper-tuned wash onto the night ground.
 */
export function washCss(wash: Wash): string {
  return (
    `:root{--color-wash:${wash.light}}` +
    `@media (prefers-color-scheme:dark){:root{--color-wash:${wash.dark}}}`
  );
}
