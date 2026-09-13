import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { serializeClubUpdate } from "@/lib/api/serialize";
import { canManageClub, clubByHandle, clubPostSchema, clubUpdates, postClubUpdate } from "@/lib/clubs";

/** The club's latest updates, newest first. */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const club = await clubByHandle((await params).handle);
  if (!club) return apiError("Not found.", 404);
  return json({ updates: (await clubUpdates(club.id, 30)).map(serializeClubUpdate) });
}

/** `{ body }` → an admin posts an update; every follower hears. */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const viewer = await apiUser(request);
  if (!viewer) return apiError("Sign in first.", 401);
  const club = await clubByHandle((await params).handle);
  if (!club || !(await canManageClub(viewer.id, club.id))) return apiError("Not found.", 404);
  const parsed = clubPostSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Write something first.", 400);
  const post = await postClubUpdate(club, viewer.id, parsed.data.body);
  return json({ update: serializeClubUpdate(post) }, 201);
}
