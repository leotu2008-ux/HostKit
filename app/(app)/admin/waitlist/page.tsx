import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AdminApproveButton } from "@/components/admin-approve-button";
import { Badge, Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Waitlist" };

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Everyone who asked to get in, newest first. Anyone but the administrator gets a 404. */
export default async function AdminWaitlistPage() {
  const user = await requireUser("/admin/waitlist");
  if (!isAdmin(user)) notFound();

  const entries = await db.emailListEntry.findMany({ orderBy: { createdAt: "desc" } });
  const waiting = entries.filter((e) => !e.approvedAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Waitlist</h1>
        <Link href="/admin/events" className="text-sm font-medium text-clay hover:underline">
          All events
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {waiting} waiting. Letting someone in emails them a link to set a password.
      </p>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nobody yet" body="Sign-ups from the homepage land here." />
        </div>
      ) : (
        <Card className="mt-6 divide-y divide-line overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{entry.name}</p>
                <p className="text-[13px] text-ink-mute">
                  {entry.email} · joined {WHEN.format(entry.createdAt)}
                </p>
              </div>
              {entry.approvedAt ? (
                <Badge tone="forest">Let in {WHEN.format(entry.approvedAt)}</Badge>
              ) : (
                <AdminApproveButton entryId={entry.id} name={entry.name} />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
