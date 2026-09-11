import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  clearDraftClaims,
  forgetDraftClaim,
  readDraftClaims,
} from "@/lib/drafts";

/** Attach any cookie-held drafts to the signed-in host, then drop the cookie. */
export async function claimDraftsForUser(userId: string) {
  const claims = await readDraftClaims();
  if (claims.length === 0) return 0;
  let claimed = 0;
  for (const claim of claims) {
    const result = await db.event.updateMany({
      where: {
        id: claim.id,
        claimToken: claim.token,
        ownerId: null,
      },
      data: { ownerId: userId, claimToken: null },
    });
    claimed += result.count;
    await forgetDraftClaim(claim.id);
  }
  if (claimed > 0) await clearDraftClaims();
  return claimed;
}

export async function claimDraftsIfSignedIn() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return claimDraftsForUser(user.id);
}

/** Cookie writes need a mutable store; Next only allows this in Server Actions
 *  or Route Handlers. claimDraftsForUser is called from auth actions. */
export async function draftsCookiePresent() {
  return Boolean((await cookies()).get("hostkit-drafts")?.value);
}
