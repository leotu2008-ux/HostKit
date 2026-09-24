"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type SectionItem = { href: string; label: string };

/**
 * The row a folded tab uses to switch between the pages it now owns
 * (Planning: Plan/Budget/Run sheet, Outreach: Threads/Vendors/Shortlist,
 * Guests: Guests/Promote/Blasts/Door).
 *
 * Underline tabs rather than the pill group it used to be: the sidebar is
 * already a stack of pills, and a second pill group directly under it read
 * as a competing primary nav. An underline sits *inside* the page instead —
 * the standard "these are views of the same thing" mark.
 */
export function SectionNav({
  items,
  label,
}: {
  items: SectionItem[];
  label: string;
}): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="no-print mb-6 max-w-full overflow-x-auto">
      <div className="flex gap-5 border-b border-line">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px shrink-0 border-b-2 pb-2.5 text-[13.5px]",
                active
                  ? "border-clay font-medium text-clay-deep"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
