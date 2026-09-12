/** Pure helpers for "Your events" — safe to import from client components. */

export type MineRole = "hosting" | "going" | "pending" | "waitlisted";

/** The pill on a "Your events" tile. */
export function mineRoleLabel(role: MineRole, published: boolean): string {
  switch (role) {
    case "hosting":
      return published ? "Hosting" : "Draft";
    case "pending":
      return "Requested";
    case "waitlisted":
      return "Waitlist";
    default:
      return "Going";
  }
}
