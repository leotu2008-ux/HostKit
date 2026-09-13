import { db } from "@/lib/db";
import { apiError, apiUser, json } from "@/lib/api/http";
import { serializeUser } from "@/lib/api/serialize";
import { assertUploadQuota, deleteImage, storeImage, validateImage } from "@/lib/images";
import { RateLimitError } from "@/lib/rate-limit";

const select = {
  id: true, name: true, email: true, schoolDomain: true, classYear: true, bio: true,
  imageUrl: true, phone: true, phoneVerifiedAt: true,
};

/** The request body is the image itself, with its Content-Type. */
export async function PUT(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);

  const contentType = request.headers.get("content-type");
  const bytes = Buffer.from(await request.arrayBuffer());
  const problem = validateImage(contentType, bytes.byteLength);
  if (problem) return apiError(problem, 400);
  try {
    await assertUploadQuota(user.id);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }

  const url = await storeImage({ bytes, contentType: contentType!, key: `avatars/${user.id}` });
  const updated = await db.user.update({ where: { id: user.id }, data: { imageUrl: url }, select });
  await deleteImage(user.imageUrl);
  return json({ user: serializeUser(updated) });
}

export async function DELETE(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const updated = await db.user.update({ where: { id: user.id }, data: { imageUrl: null }, select });
  await deleteImage(user.imageUrl);
  return json({ user: serializeUser(updated) });
}
