import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { schoolFor } from "@/lib/schools";
import { clubCategoryLabel } from "@/lib/club-format";

/** A club in a list or strip: picture, name, school, followers. */
export function ClubCard({
  club,
  compact = false,
}: {
  club: {
    handle: string;
    name: string;
    blurb?: string | null;
    imageUrl: string | null;
    schoolDomain: string | null;
    category?: string | null;
    isOfficial?: boolean;
    _count?: { followers: number };
    followers?: number;
  };
  compact?: boolean;
}) {
  const school = schoolFor(club.schoolDomain);
  const followers = club.followers ?? club._count?.followers ?? 0;
  const category = compact ? null : clubCategoryLabel(club.category);
  const official = club.isOfficial ? "Official" : null;
  return (
    <Link
      href={`/c/${club.handle}`}
      className={
        compact
          ? "flex w-[220px] shrink-0 snap-start items-center gap-3 rounded-card border border-line bg-surface p-3 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
          : "flex items-center gap-4 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
      }
    >
      <Avatar name={club.name} imageUrl={club.imageUrl} size={compact ? 40 : 48} className="rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{club.name}</span>
        <span className="block truncate text-[12px] text-ink-mute">
          {[school?.short, category, official, `${followers} ${followers === 1 ? "follower" : "followers"}`].filter(Boolean).join(" · ")}
        </span>
        {!compact && club.blurb ? (
          <span className="mt-1 line-clamp-2 block text-[13px] text-ink-soft">{club.blurb}</span>
        ) : null}
      </span>
    </Link>
  );
}
