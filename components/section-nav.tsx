"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type SectionItem = { href: string; label: string };

/**
 * The pill row a folded tab uses to switch between the pages it now owns
 * (Planning: Plan/Budget/Run sheet, Outreach: Threads/Vendors/Shortlist,
 * Guests: Guests/Promote/Blasts/Door). Same visual language as the
 * Upcoming/Past toggle on app/(app)/events/page.tsx.
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
    <nav aria-label={label} className="mb-6">
      <div className="inline-flex gap-1 rounded-full bg-sunk p-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "rounded-full px-3 py-1.5 text-[13px] font-medium",
                active
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
                  : "text-ink-soft hover:text-ink",
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
