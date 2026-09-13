import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent } from "@/lib/api/http";
import { eventInclude, serializeEvent } from "@/lib/api/serialize";
import { assertUploadQuota, deleteImage, storeImage, validateImage } from "@/lib/images";
import { RateLimitError, clientIp } from "@/lib/rate-limit";

const include = eventInclude;

/** The request body is the image itself, with its Content-Type. Works for
 *  drafts on a signed-out device too (X-HostKit-Drafts). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await apiUser(request);
  const event = await manageableEvent(request, id, viewer?.id ?? null);
  if (!event) return apiError("Event not found.", 404);

  const contentType = request.headers.get("content-type");
  const bytes = Buffer.from(await request.arrayBuffer());
  const problem = validateImage(contentType, bytes.byteLength);
  if (problem) return apiError(problem, 400);
  try {
    await assertUploadQuota(viewer?.id ?? `ip:${clientIp(request.headers)}`);
  } catch (error) {
    if (error instanceof RateLimitError) return apiError(error.message, 429);
    throw error;
  }

  const url = await storeImage({ bytes, contentType: contentType!, key: `covers/${event.id}` });
  const updated = await db.event.update({ where: { id: event.id }, data: { coverUrl: url }, include });
  await deleteImage(event.coverUrl);
  return json({ event: serializeEvent(updated, updated._count.guests, true) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await apiUser(request);
  const event = await manageableEvent(request, id, viewer?.id ?? null);
  if (!event) return apiError("Event not found.", 404);
  const updated = await db.event.update({ where: { id: event.id }, data: { coverUrl: null }, include });
  await deleteImage(event.coverUrl);
  return json({ event: serializeEvent(updated, updated._count.guests, true) });
}
