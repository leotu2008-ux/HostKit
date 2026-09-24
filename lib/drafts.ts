import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export const DRAFT_COOKIE = "hosty-drafts";
/** The cookie's name before the rebrand. Still read, so no one loses a draft;
 *  the next write moves its claims to DRAFT_COOKIE and drops it. */
export const LEGACY_DRAFT_COOKIE = "hostkit-drafts";

export type DraftClaim = { id: string; token: string };

function parseClaims(raw: string | undefined): DraftClaim[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (row): row is DraftClaim =>
          !!row &&
          typeof row === "object" &&
          typeof (row as DraftClaim).id === "string" &&
          typeof (row as DraftClaim).token === "string",
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function newClaimToken(): string {
  return randomBytes(18).toString("hex");
}

type Jar = { get(name: string): { value: string } | undefined; delete(name: string): unknown };

/** Claims from the current cookie, then any the old cookie still holds. */
function claimsIn(jar: Jar): DraftClaim[] {
  const current = parseClaims(jar.get(DRAFT_COOKIE)?.value);
  const legacy = parseClaims(jar.get(LEGACY_DRAFT_COOKIE)?.value).filter(
    (row) => !current.some((c) => c.id === row.id),
  );
  return [...current, ...legacy].slice(0, 20);
}

export async function readDraftClaims(): Promise<DraftClaim[]> {
  return claimsIn(await cookies());
}

export async function rememberDraftClaim(claim: DraftClaim) {
  const jar = await cookies();
  const existing = claimsIn(jar).filter((row) => row.id !== claim.id);
  existing.unshift(claim);
  jar.delete(LEGACY_DRAFT_COOKIE);
  jar.set(DRAFT_COOKIE, JSON.stringify(existing.slice(0, 20)), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    httpOnly: true,
  });
}

export async function forgetDraftClaim(eventId: string) {
  const jar = await cookies();
  const next = claimsIn(jar).filter((row) => row.id !== eventId);
  jar.delete(LEGACY_DRAFT_COOKIE);
  if (next.length === 0) {
    jar.delete(DRAFT_COOKIE);
    return;
  }
  jar.set(DRAFT_COOKIE, JSON.stringify(next), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    httpOnly: true,
  });
}

export async function clearDraftClaims() {
  const jar = await cookies();
  jar.delete(DRAFT_COOKIE);
  jar.delete(LEGACY_DRAFT_COOKIE);
}

export function claimMatches(
  claims: DraftClaim[],
  eventId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  return claims.some((row) => row.id === eventId && row.token === token);
}
