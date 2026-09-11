import { db } from "@/lib/db";
import { apiError, apiUser, json } from "@/lib/api/http";
import { clubViewer } from "@/lib/api/clubs";
import { serializeClub } from "@/lib/api/serialize";
import { canManageClub, clubByHandle, clubSelect } from "@/lib/clubs";
import { deleteImage, storeImage, validateImage } from "@/lib/images";

/** The club's picture — the image is the request body, like /me/avatar. */
export async function PUT(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await apiUser(request);
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(viewer?.id ?? null, club.id))) return apiError("Not found.", 404);
  const contentType = request.headers.get("content-type");
  const bytes = Buffer.from(await request.arrayBuffer());
  const problem = validateImage(contentType, bytes.byteLength);
  if (problem) return apiError(problem, 400);
  const url = await storeImage({ bytes, contentType: contentType!, key: `clubs/${club.id}` });
  const updated = await db.club.update({ where: { id: club.id }, data: { imageUrl: url }, select: clubSelect });
  await deleteImage(club.imageUrl);
  return json({ club: serializeClub(updated, await clubViewer(viewer!.id)) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await apiUser(request);
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(viewer?.id ?? null, club.id))) return apiError("Not found.", 404);
  const updated = await db.club.update({ where: { id: club.id }, data: { imageUrl: null }, select: clubSelect });
  await deleteImage(club.imageUrl);
  return json({ club: serializeClub(updated, await clubViewer(viewer!.id)) });
}
