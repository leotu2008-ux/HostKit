import { apiError, apiUser, json } from "@/lib/api/http";
import { clubViewer } from "@/lib/api/clubs";
import { serializeClub } from "@/lib/api/serialize";
import { clubByHandle, follow, unfollow } from "@/lib/clubs";

async function respond(handle: string, request: Request, action: "follow" | "unfollow") {
  const viewer = await apiUser(request);
  if (!viewer) return apiError("Sign in first.", 401);
  const club = await clubByHandle(handle);
  if (!club) return apiError("Not found.", 404);
  if (action === "follow") await follow(viewer.id, club.id);
  else await unfollow(viewer.id, club.id);
  const fresh = await clubByHandle(handle);
  return json({ club: serializeClub(fresh!, await clubViewer(viewer.id)) });
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  return respond((await params).handle, request, "follow");
}

export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  return respond((await params).handle, request, "unfollow");
}
