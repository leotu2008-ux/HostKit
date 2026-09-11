import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export const DRAFT_COOKIE = "hostkit-drafts";

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

export async function readDraftClaims(): Promise<DraftClaim[]> {
  return parseClaims((await cookies()).get(DRAFT_COOKIE)?.value);
}

export async function rememberDraftClaim(claim: DraftClaim) {
  const jar = await cookies();
  const existing = parseClaims(jar.get(DRAFT_COOKIE)?.value).filter(
    (row) => row.id !== claim.id,
  );
  existing.unshift(claim);
  jar.set(DRAFT_COOKIE, JSON.stringify(existing.slice(0, 20)), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    httpOnly: true,
  });
}

export async function forgetDraftClaim(eventId: string) {
  const jar = await cookies();
  const next = parseClaims(jar.get(DRAFT_COOKIE)?.value).filter(
    (row) => row.id !== eventId,
  );
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
  (await cookies()).delete(DRAFT_COOKIE);
}

export function claimMatches(
  claims: DraftClaim[],
  eventId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  return claims.some((row) => row.id === eventId && row.token === token);
}
