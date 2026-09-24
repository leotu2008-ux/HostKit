import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import {
  checkInGuestAction,
  undoCheckInAction,
} from "@/lib/actions/checkin";
import { Button, Card, EmptyState, Input } from "@/components/ui";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const qRaw = query.q;
  const q = String(Array.isArray(qRaw) ? qRaw[0] : (qRaw ?? ""))
    .trim()
    .toLowerCase();
  const { event } = await requireEvent(id);

  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ name: "asc" }],
  });

  const filtered = q
    ? guests.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.email ?? "").toLowerCase().includes(q),
      )
    : guests;

  const inCount = guests.filter((g) => g.checkedInAt).length;
  const going = guests.filter(
    (g) => g.rsvpStatus === "ATTENDING" || g.checkedInAt,
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
          Door
        </p>
        <h2 className="mt-1 text-[20px] font-semibold text-ink">Check-in</h2>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="tabular font-medium text-ink">{inCount}</span>{" "}
          checked in · {going} going
        </p>
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className="min-h-12"
          aria-label="Search guests"
        />
        <Button type="submit" variant="secondary" className="min-h-12! px-5">
          Find
        </Button>
      </form>

      {guests.length === 0 ? (
        <EmptyState
          title="No guests yet"
          body="Add people on the Guests tab, or share the public Register page."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No match"
          body="Try another name, or the email they registered with."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((guest) => {
            const inDoor = Boolean(guest.checkedInAt);
            return (
              <li key={guest.id}>
                <Card className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{guest.name}</p>
                    <p className="truncate text-[13px] text-ink-mute">
                      {guest.email ?? "No email"}
                      {inDoor
                        ? ` · in ${guest.checkedInAt!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                        : guest.rsvpStatus === "ATTENDING"
                          ? " · going"
                          : guest.rsvpStatus === "DECLINED"
                            ? " · not going"
                            : " · invited"}
                    </p>
                  </div>
                  {inDoor ? (
                    <form action={undoCheckInAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <Button
                        type="submit"
                        variant="secondary"
                        className="min-h-12! min-w-[7rem] bg-amber-wash text-amber"
                      >
                        Already in
                      </Button>
                    </form>
                  ) : guest.rsvpStatus === "DECLINED" ? (
                    <span className="min-h-12 min-w-[7rem] rounded-full bg-danger-wash px-3 text-center text-sm leading-[3rem] font-medium text-danger">
                      Not going
                    </span>
                  ) : (
                    <form action={checkInGuestAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <Button type="submit" className="min-h-12! min-w-[7rem]">
                        Check in
                      </Button>
                    </form>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
