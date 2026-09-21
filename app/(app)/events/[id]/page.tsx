import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { briefIsComplete, describeMissing, missingBriefFields } from "@/lib/brief";
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
import { decideRequestAction } from "@/lib/actions/waitlist";
import { Button, ButtonLink, Card, FormError } from "@/components/ui";
import { loadActivity, loadAgentStatus } from "@/lib/activity";
import { toFeedRow } from "@/lib/activity-format";
import { ActivityFeed } from "@/components/activity-feed";

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
 * The workspace landing page: what the agent still needs, the vitals, and
 * whatever's waiting on a decision. The guest list and the day-of quick
 * links used to live here too — they now have their own tabs (Guests,
 * Planning) on the sidebar, so Overview stays a status page rather than
 * growing into a second copy of the whole app.
 */
export default async function EventOverviewPage({
  params,
  searchParams,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const rawPublish = Array.isArray(query.publish) ? query.publish[0] : query.publish;
  const { event } = await requireEvent(id);

  const [guests, activityRows, agent] = await Promise.all([
    db.guest.findMany({
      where: { eventId: event.id },
      orderBy: [{ name: "asc" }],
    }),
    loadActivity(event.id, { limit: 30 }),
    loadAgentStatus(event),
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

  const stats = [
    { label: "Going", value: going },
    { label: "Checked in", value: checkedIn },
    { label: "Capacity", value: event.guestCount === 0 ? "—" : event.guestCount },
    requests.length + waitlist.length > 0
      ? { label: "Waiting", value: requests.length + waitlist.length }
      : { label: "Awaiting reply", value: invited },
  ];

  const base = `/events/${event.id}`;
  const missing = missingBriefFields(event);

  return (
    <div className="space-y-6">
      {rawPublish === "incomplete" ? (
        <FormError>
          Give this a name, a date, a city, a headcount and a budget before publishing.
        </FormError>
      ) : null}

      {!briefIsComplete(event) ? (
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="font-display text-lg text-ink">
              The agent needs {describeMissing(missing)}
            </h2>
            <p className="mt-1 text-[13px] text-ink-mute">
              Fill in the brief and it drafts the plan, finds the venue and writes the first
              messages.
            </p>
          </div>
          <ButtonLink href={`${base}/brief`} size="sm">
            Open the brief
          </ButtonLink>
        </Card>
      ) : null}

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

      <ActivityFeed
        eventId={event.id}
        initial={activityRows.map(toFeedRow)}
        agent={agent}
        now={new Date().toISOString()}
      />

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
              event.city || "City to be announced"
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
          detail={event.published ? VISIBILITY_LABEL[event.visibility] : "Draft — not visible yet"}
        />
        {event.description ? (
          <p className="border-t border-line pt-4 text-[14px] leading-relaxed text-ink-soft">
            {event.description}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
