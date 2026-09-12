import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { normalizeProfile, profileSchema } from "@/lib/profile";

/** Who the bearer token belongs to — lets the app check a saved session. */
export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  return json({ user: serializeUser(user) });
}

/** Edits name, class year, bio, the guest-list setting and the school
 *  (`schoolDomain`: a known school, or "" for none). */
export async function PATCH(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);

  // Only the keys sent are touched, so the app can PATCH one setting.
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: normalizeProfile(parsed.data),
    select: {
      id: true, name: true, email: true, schoolDomain: true, classYear: true, bio: true,
      imageUrl: true, phone: true, phoneVerifiedAt: true, showOnGuestLists: true,
    },
  });
  return json({ user: serializeUser(updated) });
}
