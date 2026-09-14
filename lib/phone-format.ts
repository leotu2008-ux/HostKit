/**
 * Pure phone helpers, safe to import from client components. The
 * verification flow itself (database, SMS) lives in lib/phone.ts.
 */

/** E.164, assuming the US for bare 10-digit numbers; null when it isn't one. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** "+16175550100" → "(617) 555-0100"; other countries keep the + form, spaced. */
export function formatPhone(e164: string): string {
  if (/^\+1\d{10}$/.test(e164)) {
    return `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`;
  }
  return e164.replace(/(\d{3})(?=\d)/g, "$1 ");
}

export function codeMessage(code: string) {
  return `Your Student Events code is ${code}. It expires in 10 minutes.`;
}
