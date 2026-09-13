import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { groupByDay } from "@/lib/day-groups";
import { markInboxReadAction } from "@/lib/actions/inbox";
import { Button, Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Inbox" };

const ICON: Record<string, string> = {
  club_published: "📣",
  club_update: "💬",
  registration_request: "🙋",
  registration_approved: "✅",
  waitlist_promoted: "🎟️",
  blast: "✉️",
};

/** Everything that happened to you, newest first. */
export default async function InboxPage() {
  const user = await requireUser("/inbox");
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const clubHandles = new Map(
    (
      await db.club.findMany({
        where: { id: { in: items.map((n) => n.clubId).filter((id): id is string => Boolean(id)) } },
        select: { id: true, handle: true },
      })
    ).map((c) => [c.id, c.handle]),
  );
  const unread = items.filter((n) => !n.readAt).length;
  const days = groupByDay(items.map((n) => ({ ...n, date: n.createdAt })));

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Inbox</h1>
        {unread > 0 ? (
          <form action={markInboxReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all read
            </Button>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing yet"
            body="When a club you follow posts, a host confirms your spot, or a spot opens up, it lands here."
          />
        </div>
      ) : (
        <ol className="mt-6 space-y-6">
          {days.map((day) => (
            <li key={day.key}>
              <p className="mb-2 text-[13px] font-medium text-ink-mute">{day.label}</p>
              <Card className="divide-y divide-line overflow-hidden">
                {day.items.map((n) => {
                  const href = n.eventId ? `/e/${n.eventId}` : n.clubId ? `/c/${clubHandles.get(n.clubId) ?? ""}` : null;
                  const inner = (
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <span aria-hidden className="mt-0.5 text-lg">{ICON[n.kind] ?? "•"}</span>
                      <span className="min-w-0 flex-1">
                        <span className={n.readAt ? "block font-medium text-ink-soft" : "block font-medium text-ink"}>
                          {n.title}
                        </span>
                        <span className="block text-[13px] text-ink-mute">{n.body}</span>
                      </span>
                      {!n.readAt ? <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay" /> : null}
                    </div>
                  );
                  return href ? (
                    <Link key={n.id} href={href} className="block hover:bg-sunk">
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
