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
  type,
  host,
  sizes = "(min-width: 768px) 400px, 100vw",
  natural = false,
}: {
  id: string;
  title: string;
  coverUrl?: string | null;
  /** Hosty's own EventType, when the caller has it. */
  type?: string | null;
  /** The club or department, which sometimes says more than the title does. */
  host?: string | null;
  sizes?: string;
  /** Show a photo at its own shape (the event page) rather than filling a box (cards). */
  natural?: boolean;
}) {
  if (coverUrl && natural) {
    return (
      <Image
        src={coverUrl}
        alt={title}
        width={1600}
        height={1000}
        sizes={sizes}
        className="block h-auto w-full"
        unoptimized={!isOurs(coverUrl)}
      />
    );
  }
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
  return <CoverArt id={id} title={title} type={type} host={host} />;
}
