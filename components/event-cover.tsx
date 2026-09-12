import Image from "next/image";
import { CoverArt } from "@/components/cover-art";

/** Photos we store: Vercel Blob, or our own /api/images fallback. */
function isOurs(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * The host's photo when they've added one, otherwise the cover drawn from
 * the id. Pictures from other sites (official campus events) are shown as
 * they are, not through the image optimizer — it only proxies our own hosts.
 */
export function EventCover({
  id,
  title,
  coverUrl,
  sizes = "(min-width: 768px) 400px, 100vw",
}: {
  id: string;
  title: string;
  coverUrl?: string | null;
  sizes?: string;
}) {
  if (coverUrl) {
    return (
      <span className="relative block h-full w-full">
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized={!isOurs(coverUrl)}
        />
      </span>
    );
  }
  return <CoverArt id={id} title={title} />;
}
