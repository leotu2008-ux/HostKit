import { randomBytes } from "node:crypto";

/**
 * Tokens for links that are their own authorisation — an invitation's RSVP
 * page. 144 random bits, hex. (Prisma's `cuid()` is unique, not secret:
 * it's built from the time and a counter.)
 */
export function newRsvpToken(): string {
  return randomBytes(18).toString("hex");
}
