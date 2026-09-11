import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readDraftClaims } from "@/lib/drafts";

/** Attach cookie-held drafts to the signed-in host. The browser cookie stays
 *  so the same device can still open the night if the session cookie lags. */
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
      data: { ownerId: userId },
    });
    claimed += result.count;
  }
  return claimed;
}

export async function claimDraftsIfSignedIn() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return claimDraftsForUser(user.id);
}
