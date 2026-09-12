import type { ClubRole } from "@/generated/prisma/enums";

/**
 * Club rules, kept pure so the cases that bite every membership system can
 * be pinned down in tests without a database: who may change whose role,
 * and the guarantee that a club can never be left without an owner.
 */

export const ROLE_LABEL: Record<ClubRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const ROLE_RANK: Record<ClubRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

/** Roles in display order, most powerful first. */
export const ROLES: ClubRole[] = ["OWNER", "ADMIN", "MEMBER"];

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

const MAX_SLUG = 48;

/**
 * URL-safe slug from a club name. Strips diacritics rather than dropping
 * accented letters, so "Café Noir" becomes "cafe-noir", not "caf-noir".
 * Empty or all-punctuation input falls back to "club" so a caller always
 * gets something routable.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
  return slug || "club";
}

/**
 * First free slug from a base: `run-club`, then `run-club-2`, `run-club-3`…
 * `taken` is a predicate rather than a list so the caller can back it with
 * a database lookup or a Set alike.
 */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
  // Ten thousand clubs with the same name is not a case worth handling well.
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function hasRole(
  role: ClubRole | null | undefined,
  min: ClubRole,
): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Owners and admins run the club: post nights, edit it, manage members. */
export function canManageClub(role: ClubRole | null | undefined): boolean {
  return hasRole(role, "ADMIN");
}

/**
 * Whether `userId` may open an event's management pages. The owner always
 * can; so can anyone who runs the club the event was posted as. Personal
 * events have no club role and fall through to the owner check.
 */
export function canManageEvent(
  event: { ownerId: string | null; clubRole?: ClubRole | null },
  userId: string | null,
): boolean {
  if (userId && event.ownerId === userId) return true;
  return canManageClub(event.clubRole);
}

/**
 * Whether an actor may set a target member's role (or remove them, when
 * `next` is null). Owners may do anything; admins may shuffle members and
 * other admins but never touch an owner or mint one. Nobody edits their own
 * role here — that goes through leave.
 */
export function canChangeRole(
  actorRole: ClubRole | null | undefined,
  targetRole: ClubRole,
  next: ClubRole | null,
): boolean {
  if (!canManageClub(actorRole)) return false;
  if (actorRole === "OWNER") return true;
  // Admin.
  if (targetRole === "OWNER") return false;
  if (next === "OWNER") return false;
  return true;
}

export type MemberLike = { userId: string; role: ClubRole };

/**
 * Refuses any change that would leave a club with no owner. Applies to
 * demoting an owner, removing an owner, and an owner leaving — all three
 * arrive here as "the only OWNER is about to stop being one".
 */
export function lastOwnerGuard(
  members: MemberLike[],
  targetUserId: string,
  next: ClubRole | null,
): { ok: true } | { ok: false; reason: string } {
  const target = members.find((m) => m.userId === targetUserId);
  if (!target) return { ok: false, reason: "That person isn't a member." };
  if (target.role !== "OWNER" || next === "OWNER") return { ok: true };

  const owners = members.filter((m) => m.role === "OWNER").length;
  if (owners <= 1) {
    return {
      ok: false,
      reason: "A club needs at least one owner. Make someone else an owner first.",
    };
  }
  return { ok: true };
}
