/** Maya Chen's seeded account. Signup never creates another User. */
export const MAYA_EMAIL = "maya@hostkit.demo";

/**
 * The dashboard is open to Maya Chen only. The email is the seeded account;
 * the name is checked too so a renamed row at that address still matches,
 * and so a different address that is actually her still matches.
 */
export function isMayaChen(user: { email: string; name: string }): boolean {
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim().toLowerCase().replace(/\s+/g, " ");
  return email === MAYA_EMAIL || name === "maya chen";
}

/** The Hosty administrator. Seeded from HOSTY_ADMIN_PASSWORD (prisma/seed.ts);
 *  the password lives only in Vercel's environment, never in this repo. */
export const ADMIN_EMAIL = "hosty@hosty.app";

/** Who gets past the closed-access gate: Maya, and the administrator. The
 *  admin match is the exact address — no name fallback, so nobody becomes an
 *  administrator by calling themselves "Hosty". */
export function hasDashboardAccess(user: { email: string; name: string }): boolean {
  return isMayaChen(user) || user.email.trim().toLowerCase() === ADMIN_EMAIL;
}
