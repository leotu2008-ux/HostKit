import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { doorList } from "@/lib/guests";
import {
  addWalkUpAction,
  checkInGuestAction,
  undoCheckInAction,
} from "@/lib/actions/checkin";
import { LocalTime } from "@/components/local-time";
import { PrintButton } from "@/components/print-button";
import { WalkUpSubmit } from "@/components/walk-up-submit";
import { formatEventDate } from "@/lib/when";
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
  const printed = doorList(guests);
  const going = printed.guests.length;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
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
        {printed.guests.length > 0 ? <PrintButton label="Print door list" /> : null}
      </div>

      <form className="no-print flex gap-2">
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
        <div className="no-print">
          <EmptyState
            title="No guests yet"
            body="Add people on the Guests tab, or share the public Register page."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="no-print">
          <EmptyState
            title="No match"
            body="Try another name, or the email they registered with."
          />
        </div>
      ) : (
        <ul className="no-print space-y-2">
          {filtered.map((guest) => {
            const inDoor = Boolean(guest.checkedInAt);
            return (
              <li key={guest.id}>
                <Card className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{guest.name}</p>
                    <p className="truncate text-[13px] text-ink-mute">
                      {guest.email ?? "No email"}
                      {inDoor ? (
                        <>
                          {" · in "}
                          <LocalTime iso={guest.checkedInAt!.toISOString()} format="time" />
                        </>
                      ) : guest.rsvpStatus === "ATTENDING" ? (
                        " · going"
                      ) : guest.rsvpStatus === "DECLINED" ? (
                        " · not going"
                      ) : (
                        " · invited"
                      )}
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
                    // They said no but turned up: the door can still let them
                    // in. Their RSVP is kept and they count as a walk-up.
                    <form action={checkInGuestAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <Button type="submit" variant="secondary" className="min-h-12! min-w-[7rem]">
                        Check in anyway
                      </Button>
                    </form>
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

      <form action={addWalkUpAction} className="no-print space-y-2 border-t border-line pt-4">
        <input type="hidden" name="eventId" value={event.id} />
        <label htmlFor="walk-up-name" className="block text-sm font-medium text-ink">
          Add walk-up
        </label>
        <div className="flex gap-2">
          <Input
            id="walk-up-name"
            name="name"
            required
            maxLength={120}
            placeholder="Name"
            className="min-h-12"
          />
          <WalkUpSubmit />
        </div>
      </form>

      {/* The print view: a paper backup for the door, for when the
          connection drops with a queue outside. A search doesn't narrow it. */}
      <div className="hidden print:block">
        <h1 className="text-[20px] font-semibold">{event.title} — door list</h1>
        <p className="text-sm">
          {event.date ? `${formatEventDate(event.date, true)} · ` : ""}
          {printed.guests.length} going
          {printed.heads > printed.guests.length
            ? ` · ${printed.heads} with plus-ones`
            : ""}
        </p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {printed.guests.map((guest) => (
              <tr key={guest.id} className="border-b border-line">
                <td className="w-8 py-2">
                  <span className="inline-flex size-4 items-center justify-center border border-ink text-xs">
                    {guest.checkedInAt ? "✓" : ""}
                  </span>
                </td>
                <td className="py-2">{guest.name}</td>
                <td className="tabular py-2 text-right">
                  {guest.plusOnes > 0 ? `+${guest.plusOnes}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
