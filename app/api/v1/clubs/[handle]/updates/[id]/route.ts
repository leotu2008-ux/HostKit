import { apiError, apiUser, json } from "@/lib/api/http";
import { canManageClub, clubByHandle, deleteClubUpdate } from "@/lib/clubs";

/** An admin takes an update down. Followers' Inbox rows stay. */
export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string; id: string }> }) {
  const { handle, id } = await params;
  const viewer = await apiUser(request);
  if (!viewer) return apiError("Sign in first.", 401);
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(viewer.id, club.id))) return apiError("Not found.", 404);
  await deleteClubUpdate(club.id, id);
  return json({ ok: true });
}
