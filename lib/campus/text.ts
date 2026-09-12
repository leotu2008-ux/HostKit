/** Small text helpers for feed content: HTML → plain text, entity decoding. */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  copy: "©",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}

/** Strips tags, decodes entities and tidies whitespace. `<br>` and block
 *  ends become line breaks so paragraphs survive. */
export function htmlToText(html: string | null | undefined, max = 2000): string | null {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Collapses whitespace in a one-line field. */
export function oneLine(value: string | null | undefined, max = 200): string | null {
  const text = htmlToText(value, max * 2)?.replace(/\s+/g, " ").trim() ?? null;
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Resolves a possibly relative href against the page it came from. */
export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(decodeEntities(href.trim()), base).toString();
  } catch {
    return null;
  }
}
