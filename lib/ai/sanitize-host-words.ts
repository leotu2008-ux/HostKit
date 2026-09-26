/**
 * The host's own words for a night (Event.kind, sent to Jev as `hostWords`),
 * with every money amount taken out and the length capped.
 *
 * A host writes "wine tasting, $2k all in" as readily as "wine tasting", and
 * the budget is the one thing no AI prompt should carry (lib/ai/guardrail.ts
 * checks model output for the same leak). The amount goes; the words around
 * it stay, so the model still knows what kind of night it is.
 */

export const HOST_WORDS_MAX_CHARS = 120;

// 1,500 · 1.500 · 1500 · 12.50
const NUMBER = String.raw`(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?`;
// A number that leads the amount is never the tail of a longer number or word.
const LEADING_NUMBER = String.raw`(?<![\w.,])${NUMBER}`;
// $2k · $1.5m · 2 grand
const SCALE = String.raw`(?:\s?(?:k|m|mm|bn|thousand|million|grand)\b)?`;
const SYMBOL = String.raw`(?:US\$|C\$|A\$|[$€£¥])`;
const CODE = String.raw`(?:USD|CAD|AUD|EUR|GBP)`;
const WORD = String.raw`(?:dollars?|bucks?|euros?|quid|grand|usd|cad|aud|eur|gbp)\b`;

const MONEY = new RegExp(
  [
    `${SYMBOL}\\s?${NUMBER}${SCALE}`, // $2k, $1,500, €300, £40
    `\\b${CODE}\\s?${NUMBER}${SCALE}`, // USD 300
    `${LEADING_NUMBER}${SCALE}\\s?(?:${SYMBOL}|${WORD})`, // 500 dollars, 300 bucks, 2 grand, 300€
  ].join("|"),
  "gi",
);

const GONE = "\u0000";

export function sanitizeHostWords(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = text
    .replace(MONEY, GONE)
    // "$20–$40", "$2k to $3k": one range, one hole.
    .replace(new RegExp(`${GONE}(?:\\s*(?:-|–|—|to)\\s*${GONE})+`, "gi"), GONE)
    .replaceAll(GONE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\s+/g, " ")
    // An amount that opened or closed the text leaves its comma or dash behind.
    .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, "");
  return capAtWord(cleaned, HOST_WORDS_MAX_CHARS);
}

/** At most `max` characters, cut at the last space when there is one. */
function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trim();
}
