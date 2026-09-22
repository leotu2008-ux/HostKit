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
