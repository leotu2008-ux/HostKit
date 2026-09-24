import Link from "next/link";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { hasStarted } from "@/lib/outcomes";
import { briefIsComplete, describeMissing, missingBriefFields } from "@/lib/brief";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { formatDurationLong, formatEventDate, formatEventTime } from "@/lib/when";
import { MapsLink } from "@/components/maps-link";
import {
  DateTile,
  IconTile,
  InfoRow,
  PinIcon,
  TicketIcon,
} from "@/components/date-tile";
import { decideRequestAction } from "@/lib/actions/waitlist";
import { runAgentAction } from "@/lib/actions/agent";
import { Button, ButtonLink, Card, FormError } from "@/components/ui";
import { loadActivity, loadAgentStatus } from "@/lib/activity";
import { toFeedRow } from "@/lib/activity-format";
import { ActivityFeed } from "@/components/activity-feed";

// "Run the agent" below is a Server Action, and an action's timeout is the
// page's — runAgent budgets 45s inside after(), well past the default.
export const maxDuration = 60;

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
 * growing into a second copy of the whole app. The owner's "Run it again"
 * button here is the mobile entry point — the workspace bar's copy of it is
 * hidden on phones.
 */
export default async function EventOverviewPage({
  params,
  searchParams,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const rawPublish = Array.isArray(query.publish) ? query.publish[0] : query.publish;
  const { event, user } = await requireEvent(id);
  const isOwner = user?.id === event.ownerId;
  const base = `/events/${event.id}`;
  const series = event.seriesId
    ? await db.series.findUnique({ where: { id: event.seriesId }, select: { id: true, name: true } })
    : null;

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

  // The four KPI tiles. Each number gets a line saying what it's a number
  // *of* — a bare "0 / Checked in" told a host nothing they didn't know.
  const stats: Array<{ label: string; value: number | string; sub?: string }> = [
    {
      label: "Going",
      value: going,
      sub: event.guestCount > 0 ? `of ${event.guestCount}` : undefined,
    },
    {
      label: "Checked in",
      value: checkedIn,
      sub: going > 0 ? `${Math.round((checkedIn / going) * 100)}% of going` : undefined,
    },
    {
      label: "Capacity",
      value: event.guestCount === 0 ? "—" : event.guestCount,
      sub: "planning figure",
    },
    requests.length + waitlist.length > 0
      ? {
          label: "Waiting",
          value: requests.length + waitlist.length,
          sub: "need a decision",
        }
      : { label: "Awaiting reply", value: invited, sub: "haven’t replied" },
  ];

  const missing = missingBriefFields(event);

  return (
    <div className="space-y-6">
      {isOwner ? (
        <div className="flex flex-wrap items-center gap-3">
          {series ? (
            <p className="text-[13px] text-ink-mute">
              Part of{" "}
              <Link href={`/series/${series.id}`} className="font-medium text-clay hover:underline">
                {series.name}
              </Link>
            </p>
          ) : null}
          <ButtonLink href={`${base}/run-again`} variant="secondary" size="sm" className="ml-auto">
            Run it again
          </ButtonLink>
        </div>
      ) : null}

      {rawPublish === "incomplete" ? (
        <FormError>
          Give this a name, a date, a city, a headcount and a budget before publishing.
        </FormError>
      ) : null}

      {!briefIsComplete(event) ? (
        // Tinted, because on a half-finished night this is the one thing
        // worth doing — everything else on the page is waiting on it.
        <Card className="space-y-3 border-brand/30 bg-brand-wash p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
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
            <p className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">
              {stat.label}
            </p>
            <p className="tabular mt-1.5 text-[24px] leading-none font-semibold text-ink">
              {stat.value}
            </p>
            {/* Grid items stretch, so a tile with no sub-line is still
                the same height as the ones that have one. */}
            {stat.sub ? <p className="mt-1.5 text-[12px] text-ink-mute">{stat.sub}</p> : null}
          </Card>
        ))}
      </div>

      <ActivityFeed
        eventId={event.id}
        initial={activityRows.map(toFeedRow)}
        agent={agent}
        now={new Date().toISOString()}
        frame="card"
      />

      {/* The agent runs itself when the brief completes; this is for the host
          who wants another pass on a brief that hasn't changed. Hidden while
          it's working — pressing it again would only be told "already
          running". */}
      {briefIsComplete(event) && agent.status !== "running" ? (
        <form action={runAgentAction}>
          <input type="hidden" name="eventId" value={event.id} />
          <Button type="submit" variant="secondary" size="sm">
            Run the agent
          </Button>
        </form>
      ) : null}

      {requests.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Requests</h2>
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
            <h2 className="text-[15px] font-semibold text-ink">Waitlist</h2>
            <p className="text-[13px] text-ink-mute">
              {waitlist.length} in line, oldest first.{" "}
              {hasStarted(event)
                ? "The night has started, so they only move up when you let them in."
                : "They move up automatically when a spot opens."}
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
              ? `${formatEventTime(event.date)} · ${formatDurationLong(event.durationHours)}`
              : formatDurationLong(event.durationHours)
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
