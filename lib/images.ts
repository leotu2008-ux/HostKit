import { del, put } from "@vercel/blob";
import { db } from "@/lib/db";

/** Photos people upload: profile pictures and event covers. */
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const FALLBACK_PREFIX = "/api/images/";

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Why an upload can't be accepted, or null when it's fine. Both apps
 *  downscale to JPEG before sending, so anything else is a bad client. */
export function validateImage(contentType: string | null, size: number) {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(type)) return "Use a JPEG, PNG or WebP image.";
  if (size <= 0) return "That image is empty.";
  if (size > MAX_IMAGE_BYTES) return "Images can be up to 5 MB.";
  return null;
}

/**
 * Stores the bytes and returns a public URL. With Vercel Blob configured
 * that's a CDN URL; otherwise the bytes go in Postgres and the URL points
 * at /api/images/:id, so local development needs no storage service.
 */
export async function storeImage({
  bytes,
  contentType,
  key,
}: {
  bytes: Buffer;
  contentType: string;
  key: string;
}) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (isBlobConfigured()) {
    const blob = await put(key, bytes, { access: "public", contentType: type, addRandomSuffix: true });
    return blob.url;
  }
  const row = await db.image.create({
    data: { bytes: Uint8Array.from(bytes), contentType: type },
    select: { id: true },
  });
  return `${FALLBACK_PREFIX}${row.id}`;
}

/** Best effort: a stale file left behind is not worth failing the request. */
export async function deleteImage(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(FALLBACK_PREFIX)) {
      await db.image.deleteMany({ where: { id: url.slice(FALLBACK_PREFIX.length) } });
    } else if (isBlobConfigured()) {
      await del(url);
    }
  } catch {
    // ignore
  }
}
