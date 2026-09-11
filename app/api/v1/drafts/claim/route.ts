import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";

const schema = z.object({
  drafts: z
    .array(z.object({ id: z.string().min(1), token: z.string().min(1) }))
    .max(20),
});

/**
 * Attaches drafts a device made while signed out to the host who just signed
 * in — the API twin of lib/actions/claim.ts. Only drafts whose token matches
 * move; anything else is silently left alone.
 */
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Send the drafts to claim.", 400);

  const claimed: string[] = [];
  for (const draft of parsed.data.drafts) {
    const result = await db.event.updateMany({
      where: { id: draft.id, claimToken: draft.token, ownerId: null },
      data: { ownerId: user.id, schoolDomain: user.schoolDomain },
    });
    if (result.count > 0) claimed.push(draft.id);
  }
  return json({ claimed });
}
