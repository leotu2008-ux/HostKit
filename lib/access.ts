/** Maya Chen's seeded account. Signup never creates another User. */
export const MAYA_EMAIL = "maya@hosty.demo";
/** Her address before the rebrand; the seed renames it, and a database that
 *  hasn't been reseeded yet still counts. */
export const LEGACY_MAYA_EMAIL = "maya@hostkit.demo";

/**
 * Whether this is the seeded demo account.
 *
 * Match the exact demo addresses only. A display name of "Maya Chen" on any
 * other account is not her — anyone can choose that name.
 */
export function isMayaChen(user: { email: string; name?: string }): boolean {
  const email = user.email.trim().toLowerCase();
  return email === MAYA_EMAIL || email === LEGACY_MAYA_EMAIL;
}

/**
 * Administrator addresses from `ADMIN_EMAILS` (comma-separated).
 *
 * Trimmed and compared case-insensitively. Unset, blank, or only commas
 * means nobody is an administrator.
 */
export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

/**
 * The first `ADMIN_EMAILS` address, which the seed uses for the admin row.
 * Empty when the variable is unset — the seed then skips that row.
 * Evaluated when this module loads, after dotenv in the seed process.
 */
export const ADMIN_EMAIL = adminEmails()[0] ?? "";

/** Who gets past the closed-access gate: Maya, an administrator, and anyone
 *  an administrator approved off the waitlist (lib/waitlist-approval.ts). */
export function hasDashboardAccess(user: { email: string; name: string; approvedAt: Date | null }): boolean {
  return isMayaChen(user) || isAdmin(user) || user.approvedAt !== null;
}

/** An administrator — an address in `ADMIN_EMAILS`, no name fallback. Gates
 *  the admin page and actions that reach across other people's data. */
export function isAdmin(user: { email: string }): boolean {
  const email = user.email.trim().toLowerCase();
  return email.length > 0 && adminEmails().includes(email);
}
