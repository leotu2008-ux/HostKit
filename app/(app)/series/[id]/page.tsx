import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Every night in one series, newest first, with how many came. Owner only. */
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
          outcome: { select: { checkedIn: true } },
          _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
        },
      },
    },
  });
  if (!series) notFound();

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
            <span className="text-[13px] text-ink-soft">
              {e.outcome ? `${e.outcome.checkedIn} came` : `${e._count.guests} going`}
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
