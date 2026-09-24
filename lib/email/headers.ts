/**
 * Remove CR and LF from a value that will sit in an email header.
 *
 * A subject, display name, or Reply-To that contains a newline is not one
 * value anymore: everything after the break becomes a second header
 * (`Bcc`, `Reply-To`, whatever the sender wanted). Host-authored text has
 * to pass through here before it is placed in a header.
 */
export function stripHeader(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

/**
 * The same strip, for a map of extra headers. Names that are empty after
 * the strip are dropped. Values are left otherwise intact.
 */
export function plainHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const key = stripHeader(name).trim();
    if (!key) continue;
    out[key] = stripHeader(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
