import Link from "next/link";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { formatEventDate, formatEventTime } from "@/lib/when";
import { MapsLink } from "@/components/maps-link";
import { AddCollaboratorForm } from "@/components/add-collaborator-form";
import {
  DateTile,
  IconTile,
  InfoRow,
  PinIcon,
  TicketIcon,
} from "@/components/date-tile";
import {
  removeCollaboratorAction,
  setCollaboratorStatusAction,
} from "@/lib/actions/collaborators";
import { checkInGuestAction, undoCheckInAction } from "@/lib/actions/checkin";
import { Badge, Button, ButtonLink, Card, EmptyState, type Tone } from "@/components/ui";
import type {
  CollaboratorKind,
  CollaboratorStatus,
  RsvpStatus,
} from "@/generated/prisma/enums";

const KINDS: Array<{
  kind: CollaboratorKind;
  title: string;
  add: string;
  name: string;
  detail: string;
}> = [
  { kind: "VENUE", title: "Venue holds", add: "Add venue hold", name: "Venue", detail: "Address or note" },
  { kind: "SPEAKER", title: "Speakers", add: "Add speaker", name: "Speaker", detail: "Talk title or role" },
  { kind: "COHOST", title: "Cohosts", add: "Add cohost", name: "Cohost", detail: "How they’re helping" },
];

const GUEST_STATUS: Record<RsvpStatus, { label: string; tone: Tone }> = {
  INVITED: { label: "Invited", tone: "neutral" },
  ATTENDING: { label: "Going", tone: "forest" },
  MAYBE: { label: "Maybe", tone: "amber" },
  DECLINED: { label: "Not going", tone: "danger" },
};

const PEOPLE_TONE: Record<CollaboratorStatus, Tone> = {
  PENDING: "amber",
  CONFIRMED: "forest",
  DECLINED: "danger",
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
 * headline counts, the guest list with one-tap check-in, and the event and
 * its people alongside.
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

  const [guests, collaborators] = await Promise.all([
    db.guest.findMany({
      where: { eventId: event.id },
      orderBy: [{ name: "asc" }],
    }),
    db.eventCollaborator.findMany({
      where: { eventId: event.id },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const going = guests.filter((g) => g.rsvpStatus === "ATTENDING").length;
  const checkedIn = guests.filter((g) => g.checkedInAt).length;
  const invited = guests.filter((g) => g.rsvpStatus === "INVITED").length;
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
    { label: "Awaiting reply", value: invited },
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
        <section>
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
                <ButtonLink href={`/events/${event.id}/guests`} variant="secondary" size="sm">
                  Add guests
                </ButtonLink>
                <ButtonLink href={`/events/${event.id}/check-in`} size="sm">
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
                  <Link
                    href={`/events/${event.id}`}
                    className="text-sm font-medium text-ink-soft hover:text-ink"
                  >
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
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-clay to-amber text-[12px] font-semibold text-white">
                        {initials(guest.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{guest.name}</p>
                        <p className="truncate text-[13px] text-ink-mute">
                          {isIn
                            ? `In at ${guest.checkedInAt!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                            : (guest.email ?? "No email")}
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

          <Card className="divide-y divide-line overflow-hidden">
            {KINDS.map((section) => {
              const rows = collaborators.filter((row) => row.kind === section.kind);
              return (
                <div key={section.kind} className="px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                    <span className="text-[12px] text-ink-mute">
                      {rows.filter((r) => r.status === "PENDING").length} pending
                    </span>
                  </div>
                  {rows.length > 0 ? (
                    <ul className="mb-2 space-y-2">
                      {rows.map((row) => (
                        <li key={row.id} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-ink">{row.name}</p>
                            {row.detail || row.email ? (
                              <p className="truncate text-[12px] text-ink-mute">
                                {row.detail ?? row.email}
                              </p>
                            ) : null}
                          </div>
                          <form action={setCollaboratorStatusAction}>
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="collaboratorId" value={row.id} />
                            <button
                              name="status"
                              value={row.status === "CONFIRMED" ? "PENDING" : "CONFIRMED"}
                              title={row.status === "CONFIRMED" ? "Mark pending" : "Confirm"}
                            >
                              <Badge tone={PEOPLE_TONE[row.status]}>
                                {row.status === "CONFIRMED" ? "Confirmed" : row.status === "DECLINED" ? "Declined" : "Pending"}
                              </Badge>
                            </button>
                          </form>
                          <form action={removeCollaboratorAction}>
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="collaboratorId" value={row.id} />
                            <button
                              type="submit"
                              aria-label={`Remove ${row.name}`}
                              className="px-1 text-ink-mute hover:text-danger"
                            >
                              ×
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[13px] font-medium text-clay [&::-webkit-details-marker]:hidden">
                      + {section.add}
                    </summary>
                    <div className="mt-3">
                      <AddCollaboratorForm
                        eventId={event.id}
                        kind={section.kind}
                        nameLabel={section.name}
                        detailLabel={section.detail}
                        submitLabel={section.add}
                      />
                    </div>
                  </details>
                </div>
              );
            })}
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
                  href={`/events/${event.id}/${path}`}
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
