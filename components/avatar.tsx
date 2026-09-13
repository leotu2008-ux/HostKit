import Image from "next/image";
import { cx } from "@/components/ui";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** A person: their photo when they've added one, otherwise initials on the brand gradient. */
export function Avatar({
  name,
  imageUrl,
  size = 36,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.34) };
  if (imageUrl) {
    return (
      <span
        className={cx("relative block shrink-0 overflow-hidden rounded-full bg-sunk", className)}
        style={style}
      >
        <Image src={imageUrl} alt="" fill sizes={`${size * 2}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-soft to-ink font-semibold text-paper",
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}
