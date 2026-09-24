/** Maya Chen's seeded account. Signup never creates another User. */
export const MAYA_EMAIL = "maya@hosty.demo";
/** Her address before the rebrand; the seed renames it, and a database that
 *  hasn't been reseeded yet still counts. */
export const LEGACY_MAYA_EMAIL = "maya@hostkit.demo";

/**
 * Whether this is Maya Chen. The email is the seeded account;
 * the name is checked too so a renamed row at that address still matches,
 * and so a different address that is actually her still matches.
 */
export function isMayaChen(user: { email: string; name: string }): boolean {
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim().toLowerCase().replace(/\s+/g, " ");
  return email === MAYA_EMAIL || email === LEGACY_MAYA_EMAIL || name === "maya chen";
}

/** The Hosty administrator. Seeded from HOSTY_ADMIN_PASSWORD (prisma/seed.ts);
 *  the password lives only in Vercel's environment, never in this repo. */
export const ADMIN_EMAIL = "leowomc@gmail.com";

/** Who gets past the closed-access gate: Maya, the administrator, and anyone
 *  the administrator approved off the waitlist (lib/waitlist-approval.ts). */
export function hasDashboardAccess(user: { email: string; name: string; approvedAt: Date | null }): boolean {
  return isMayaChen(user) || isAdmin(user) || user.approvedAt !== null;
}

/** The administrator only — exact address, no name fallback. Gates the admin
 *  page and actions that reach across other people's data. */
export function isAdmin(user: { email: string }): boolean {
  return user.email.trim().toLowerCase() === ADMIN_EMAIL;
}
