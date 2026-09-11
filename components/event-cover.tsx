import Image from "next/image";
import { CoverArt } from "@/components/cover-art";

/** The host's photo when they've added one, otherwise the cover drawn from the id. */
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
        <Image src={coverUrl} alt={title} fill sizes={sizes} className="object-cover" />
      </span>
    );
  }
  return <CoverArt id={id} title={title} />;
}
