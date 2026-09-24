import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { nightlyTurnout, type NightTurnout } from "@/lib/guest-book";
import { Card } from "@/components/ui";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function turnoutLine(t: NightTurnout | undefined): string | null {
  return t ? `${t.came} came · ${t.fresh} new` : null;
}

/**
 * Every night in one series, newest first. A night that happened shows how
 * many came and how many were new to the host; one ahead shows who's going.
 * Owner only.
 */
export default async function SeriesPage({ params }: PageProps<"/series/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/series/${id}`);
  const series = await db.series.findFirst({
    where: { id, ownerId: user.id },
    include: {
      events: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          date: true,
          _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
        },
      },
    },
  });
  if (!series) notFound();
  const turnout = await nightlyTurnout(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <p className="text-[13px] font-medium text-ink-mute">Series</p>
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">{series.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {series.events.length} {series.events.length === 1 ? "night" : "nights"}
      </p>
      <Card className="mt-6 divide-y divide-line overflow-hidden">
        {series.events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-sunk">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{e.title}</span>
              <span className="block text-[13px] text-ink-mute">{e.date ? WHEN.format(e.date) : "No date yet"}</span>
            </span>
            <span className="shrink-0 text-[13px] text-ink-soft">
              {turnoutLine(turnout.get(e.id)) ?? `${e._count.guests} going`}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
