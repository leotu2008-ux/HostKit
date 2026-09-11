import { db } from "@/lib/db";

/** Serves an uploaded image from Postgres — only used when Vercel Blob isn't configured. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.image.findUnique({ where: { id } });
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
