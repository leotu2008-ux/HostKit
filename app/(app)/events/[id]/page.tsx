import Link from "next/link";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { guestPhone, verifiedPhone } from "@/lib/api/serialize";
import { formatPhone } from "@/lib/phone";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { formatEventDate, formatEventTime } from "@/lib/when";
import { MapsLink } from "@/components/maps-link";
import {
  DateTile,
  IconTile,
  InfoRow,
  PinIcon,
  TicketIcon,
} from "@/components/date-tile";
import { checkInGuestAction, undoCheckInAction } from "@/lib/actions/checkin";
import { decideRequestAction } from "@/lib/actions/waitlist";
import { Badge, Button, ButtonLink, Card, EmptyState, type Tone } from "@/components/ui";
import type { RsvpStatus } from "@/generated/prisma/enums";

const GUEST_STATUS: Record<RsvpStatus, { label: string; tone: Tone }> = {
  INVITED: { label: "Invited", tone: "neutral" },
  ATTENDING: { label: "Going", tone: "forest" },
  MAYBE: { label: "Maybe", tone: "amber" },
  DECLINED: { label: "Not going", tone: "danger" },
  PENDING: { label: "Requested", tone: "amber" },
  WAITLISTED: { label: "Waitlist", tone: "neutral" },
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * The host's view of one night — the website twin of the iOS Manage screen:
 * headline counts, what to do next, the guest list with one-tap check-in,
 * and the event alongside.
 */
export default async function EventOverviewPage({
  params,
  searchParams,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const rawQ = Array.isArray(query.q) ? query.q[0] : query.q;
  const q = (rawQ ?? "").trim();
  const { event } = await requireEvent(id);

  const [guests, collaborators, blastCount] = await Promise.all([
    db.guest.findMany({
      where: { eventId: event.id },
      orderBy: [{ name: "asc" }],
      include: guestPhone,
    }),
    db.eventCollaborator.findMany({
      where: { eventId: event.id },
      select: { kind: true, status: true },
    }),
    db.blast.count({ where: { eventId: event.id } }),
  ]);

  const going = guests.filter((g) => g.rsvpStatus === "ATTENDING").length;
  const checkedIn = guests.filter((g) => g.checkedInAt).length;
  const invited = guests.filter((g) => g.rsvpStatus === "INVITED").length;
  const requests = guests
    .filter((g) => g.rsvpStatus === "PENDING")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const waitlist = guests
    .filter((g) => g.rsvpStatus === "WAITLISTED")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const needle = q.toLowerCase();
  const shown = needle
    ? guests.filter(
        (g) =>
          g.name.toLowerCase().includes(needle) ||
          (g.email ?? "").toLowerCase().includes(needle),
      )
    : guests;

  const stats = [
    { label: "Going", value: going },
    { label: "Checked in", value: checkedIn },
    { label: "Capacity", value: event.guestCount },
    requests.length + waitlist.length > 0
      ? { label: "Waiting", value: requests.length + waitlist.length }
      : { label: "Awaiting reply", value: invited },
  ];

  // What still needs doing, each pointing at the tab that does it.
  const venue = collaborators.find((c) => c.kind === "VENUE");
  const pendingOutreach = collaborators.filter((c) => c.status === "PENDING").length;
  const base = `/events/${event.id}`;
  const nextUp: Array<{ done: boolean; title: string; hint: string; href: string }> = [
    {
      done: Boolean(venue && venue.status === "CONFIRMED"),
      title: venue ? (venue.status === "CONFIRMED" ? "Venue confirmed" : "Confirm the venue") : "Line up a venue",
      hint: venue ? "Draft the message and mark it confirmed once they say yes." : "Add one on Outreach, or search when you edit the event.",
      href: `${base}/outreach`,
    },
    {
      done: pendingOutreach === 0 && collaborators.length > 0,
      title: pendingOutreach > 0 ? `Reach ${pendingOutreach} ${pendingOutreach === 1 ? "person" : "people"}` : "Outreach up to date",
      hint: "Speakers, cohosts, vendors — each has a first message drafted.",
      href: `${base}/outreach`,
    },
    {
      done: event.published,
      title: event.published ? "Published" : "Publish and share",
      hint: event.published ? `${VISIBILITY_LABEL[event.visibility]} · link and QR on Promote.` : "Guests can't register until it's live.",
      href: `${base}/promote`,
    },
    {
      done: blastCount > 0,
      title: blastCount > 0 ? `${blastCount} ${blastCount === 1 ? "update" : "updates"} sent` : "Send guests an update",
      hint: "Doors, parking, what to bring — straight to the email they registered with.",
      href: `${base}/blasts`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="tabular text-[26px] leading-none font-semibold text-ink">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[13px] text-ink-mute">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-6">
          <Card className="divide-y divide-line overflow-hidden">
            <div className="px-5 py-4">
              <h2 className="font-display text-lg text-ink">Next up</h2>
            </div>
            {nextUp.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-sunk"
              >
                <span
                  aria-hidden
                  className={
                    item.done
                      ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] text-white"
                      : "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-line-strong"
                  }
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={item.done ? "block font-medium text-ink-mute line-through" : "block font-medium text-ink"}>
                    {item.title}
                  </span>
                  <span className="block text-[13px] text-ink-mute">{item.hint}</span>
                </span>
                <span aria-hidden className="text-ink-mute">›</span>
              </Link>
            ))}
          </Card>

          {requests.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-display text-lg text-ink">Requests</h2>
                <p className="text-[13px] text-ink-mute">
                  {requests.length} waiting for a yes. Approving into a full night puts them on the waitlist.
                </p>
              </div>
              <ul className="divide-y divide-line">
                {requests.map((guest) => (
                  <li key={guest.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-soft to-ink text-[12px] font-semibold text-paper">
                      {initials(guest.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{guest.name}</p>
                      <p className="truncate text-[13px] text-ink-mute">{guest.email ?? "No email"}</p>
                    </div>
                    <form action={decideRequestAction} className="flex gap-2">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <Button type="submit" name="decision" value="approve" size="sm">
                        Approve
                      </Button>
                      <Button type="submit" name="decision" value="decline" variant="ghost" size="sm">
                        Decline
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {waitlist.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-display text-lg text-ink">Waitlist</h2>
                <p className="text-[13px] text-ink-mute">
                  {waitlist.length} in line, oldest first. They move up automatically when a spot opens.
                </p>
              </div>
              <ol className="divide-y divide-line">
                {waitlist.map((guest, index) => (
                  <li key={guest.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="tabular w-6 text-right text-[13px] text-ink-mute">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{guest.name}</p>
                      <p className="truncate text-[13px] text-ink-mute">{guest.email ?? "No email"}</p>
                    </div>
                    <form action={decideRequestAction} className="flex gap-2">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="guestId" value={guest.id} />
                      <Button type="submit" name="decision" value="approve" variant="secondary" size="sm">
                        Let in
                      </Button>
                    </form>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-lg text-ink">Guests</h2>
                <p className="text-[13px] text-ink-mute">
                  {guests.length === 0
                    ? "No one yet"
                    : `${guests.length} on the list · ${checkedIn} through the door`}
                </p>
              </div>
              <div className="flex gap-2">
                <ButtonLink href={`${base}/guests`} variant="secondary" size="sm">
                  Add guests
                </ButtonLink>
                <ButtonLink href={`${base}/check-in`} size="sm">
                  Door mode
                </ButtonLink>
              </div>
            </div>

            {guests.length > 0 ? (
              <form className="flex items-center gap-2 border-b border-line px-5 py-3">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Find a guest by name or email"
                  aria-label="Find a guest"
                  className="min-h-10 flex-1 rounded-lg border border-line bg-sunk px-3 text-[15px] text-ink placeholder:text-ink-mute focus:border-clay focus:outline-none"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
                {q ? (
                  <Link href={base} className="text-sm font-medium text-ink-soft hover:text-ink">
                    Clear
                  </Link>
                ) : null}
              </form>
            ) : null}

            {guests.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No guests yet"
                  body={
                    event.published
                      ? "Share the event page to get registrations, or add people yourself."
                      : "Publish the event so guests can register, or add people yourself."
                  }
                />
              </div>
            ) : shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-[15px] text-ink-soft">
                No one matches “{q}”.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((guest) => {
                  const status = GUEST_STATUS[guest.rsvpStatus];
                  const isIn = Boolean(guest.checkedInAt);
                  return (
                    <li key={guest.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-soft to-ink text-[12px] font-semibold text-paper">
                        {initials(guest.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{guest.name}</p>
                        <p className="truncate text-[13px] text-ink-mute">
                          {isIn
                            ? `In at ${guest.checkedInAt!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                            : (guest.email ?? "No email")}
                          {!isIn && verifiedPhone(guest.user) ? (
                            <>
                              {" · "}
                              <a href={`tel:${verifiedPhone(guest.user)}`} className="hover:text-ink">
                                {formatPhone(verifiedPhone(guest.user)!)}
                              </a>
                            </>
                          ) : null}
                          {guest.plusOnes > 0 ? ` · +${guest.plusOnes}` : ""}
                        </p>
                      </div>
                      <Badge tone={status.tone} className="hidden sm:inline-flex">
                        {status.label}
                      </Badge>
                      {isIn ? (
                        <form action={undoCheckInAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="guestId" value={guest.id} />
                          <button
                            type="submit"
                            title="Undo check-in"
                            className="min-h-9 min-w-[6.5rem] rounded-full bg-forest-wash px-3 text-sm font-medium text-forest"
                          >
                            ✓ In
                          </button>
                        </form>
                      ) : guest.rsvpStatus !== "DECLINED" ? (
                        <form action={checkInGuestAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="guestId" value={guest.id} />
                          <button
                            type="submit"
                            className="min-h-9 min-w-[6.5rem] rounded-full border border-line-strong px-3 text-sm font-medium text-ink hover:border-clay hover:text-clay"
                          >
                            Check in
                          </button>
                        </form>
                      ) : (
                        <span className="min-w-[6.5rem]" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="space-y-4 p-5">
            <InfoRow
              tile={<DateTile date={event.date} />}
              title={formatEventDate(event.date, true) ?? "Date to be announced"}
              detail={
                event.date
                  ? `${formatEventTime(event.date)} · ${event.durationHours} hours`
                  : `${event.durationHours} hours`
              }
            />
            <InfoRow
              tile={
                <IconTile>
                  <PinIcon />
                </IconTile>
              }
              title={
                event.address ? (
                  <MapsLink
                    target={{
                      address: event.address,
                      lat: event.lat,
                      lng: event.lng,
                      label: event.title,
                    }}
                    className="hover:underline"
                  >
                    {event.address}
                  </MapsLink>
                ) : (
                  event.city
                )
              }
              detail={event.address ? event.city : undefined}
            />
            <InfoRow
              tile={
                <IconTile>
                  <TicketIcon />
                </IconTile>
              }
              title={
                event.ticketType === "PAID"
                  ? `${formatCents(event.ticketPriceCents)} a ticket`
                  : "Free"
              }
              detail={
                event.published ? VISIBILITY_LABEL[event.visibility] : "Draft — not visible yet"
              }
            />
            {event.description ? (
              <p className="border-t border-line pt-4 text-[14px] leading-relaxed text-ink-soft">
                {event.description}
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink">Planner</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute">
              Budget, venues and the day-of schedule.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["plan", "Plan"],
                ["budget", "Budget"],
                ["discover", "Scout"],
                ["runsheet", "Run sheet"],
              ].map(([path, label]) => (
                <Link
                  key={path}
                  href={`${base}/${path}`}
                  className="rounded-full bg-sunk px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
                >
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
