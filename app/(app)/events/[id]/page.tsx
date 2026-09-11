import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { summarizeGuests } from "@/lib/guests";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { formatEventDate, formatEventTime } from "@/lib/when";
import { MapsLink } from "@/components/maps-link";
import { AddCollaboratorForm } from "@/components/add-collaborator-form";
import {
  setCollaboratorStatusAction,
  removeCollaboratorAction,
} from "@/lib/actions/collaborators";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import type { CollaboratorKind, CollaboratorStatus } from "@/generated/prisma/enums";

const KIND_COPY: Record<
  CollaboratorKind,
  { title: string; empty: string; add: string; name: string; detail: string }
> = {
  VENUE: {
    title: "Pending venues",
    empty: "Hold rooms you’re waiting on — not the catalog scout.",
    add: "Add a venue hold",
    name: "Venue",
    detail: "Address or note",
  },
  SPEAKER: {
    title: "Speakers",
    empty: "No speakers yet.",
    add: "Add a speaker",
    name: "Speaker",
    detail: "Talk title or role",
  },
  COHOST: {
    title: "Cohosts",
    empty: "No cohosts yet.",
    add: "Add a cohost",
    name: "Cohost",
    detail: "How they’re helping",
  },
};

const STATUS_LABEL: Record<CollaboratorStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
};

export default async function EventDashboardPage({
  params,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { event, user } = await requireEvent(id);

  const [collaborators, guests] = await Promise.all([
    db.eventCollaborator.findMany({
      where: { eventId: event.id },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    db.guest.findMany({
      where: { eventId: event.id },
      orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
    }),
  ]);

  const summary = summarizeGuests(guests);
  const pendingGuests = guests.filter((g) => g.rsvpStatus === "INVITED");
  const kinds: CollaboratorKind[] = ["VENUE", "SPEAKER", "COHOST"];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
          Dashboard
        </p>
        <h2 className="font-display mt-1 text-[22px] text-ink">This night</h2>
        <Card className="mt-3 space-y-3 p-4">
          <p className="font-medium text-ink">
            {formatEventDate(event.date, true) ?? "Date to be announced"}
            {formatEventTime(event.date) ? (
              <span className="text-ink-soft">
                {" "}
                · {formatEventTime(event.date)}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-ink-soft">
            {event.address ? (
              <MapsLink
                target={{
                  address: event.address,
                  lat: event.lat,
                  lng: event.lng,
                  label: event.title,
                }}
                className="font-medium text-clay"
              />
            ) : (
              event.city
            )}
          </p>
          <p className="text-sm text-ink-mute">
            {event.ticketType === "PAID"
              ? `${formatCents(event.ticketPriceCents)} a ticket`
              : "Free"}
            {" · "}
            {event.guestCount} capacity
            {" · "}
            {VISIBILITY_LABEL[event.visibility]}
          </p>
          {event.description ? (
            <p className="text-[15px] leading-relaxed text-ink-soft">
              {event.description}
            </p>
          ) : null}
        </Card>
      </section>

      {kinds.map((kind) => {
        const rows = collaborators.filter((row) => row.kind === kind);
        const copy = KIND_COPY[kind];
        return (
          <section key={kind}>
            <SectionHeading
              title={copy.title}
              hint={`${rows.filter((r) => r.status === "PENDING").length} pending`}
            />
            {rows.length === 0 ? (
              <EmptyState title={`No ${copy.title.toLowerCase()}`} body={copy.empty} />
            ) : (
              <Card className="mb-3 divide-y divide-line">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{row.name}</p>
                      <p className="text-sm text-ink-soft">
                        {row.email ?? row.detail ?? "—"}
                        {row.email && row.detail ? ` · ${row.detail}` : ""}
                      </p>
                    </div>
                    <Badge
                      tone={
                        row.status === "CONFIRMED"
                          ? "forest"
                          : row.status === "DECLINED"
                            ? "danger"
                            : "amber"
                      }
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                    <form action={setCollaboratorStatusAction} className="flex gap-2">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="collaboratorId" value={row.id} />
                      {row.status !== "CONFIRMED" ? (
                        <button
                          name="status"
                          value="CONFIRMED"
                          className="text-sm font-medium text-forest"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          name="status"
                          value="PENDING"
                          className="text-sm font-medium text-ink-mute"
                        >
                          Undo
                        </button>
                      )}
                    </form>
                    <form action={removeCollaboratorAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="collaboratorId" value={row.id} />
                      <button className="text-sm text-ink-mute" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </Card>
            )}
            <Card className="p-4">
              <AddCollaboratorForm
                eventId={event.id}
                kind={kind}
                nameLabel={copy.name}
                detailLabel={copy.detail}
                submitLabel={copy.add}
              />
            </Card>
          </section>
        );
      })}

      <section>
        <SectionHeading
          title="Attendees"
          hint={`${summary.confirmedHeads} going · ${summary.awaiting} pending`}
          action={
            <ButtonLink href={`/events/${event.id}/guests`} size="sm" variant="secondary">
              Full list
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <p className="font-display tabular text-xl text-ink">{summary.confirmedHeads}</p>
            <p className="text-[12px] text-ink-mute">Going</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="font-display tabular text-xl text-ink">{summary.awaiting}</p>
            <p className="text-[12px] text-ink-mute">Pending</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="font-display tabular text-xl text-ink">{event.guestCount}</p>
            <p className="text-[12px] text-ink-mute">Capacity</p>
          </Card>
        </div>
        {pendingGuests.length === 0 ? (
          <p className="mt-3 text-sm text-ink-mute">
            {user
              ? "Invite guests from the list when you’re ready."
              : "Sign in to publish, then invite people."}
          </p>
        ) : (
          <Card className="mt-3 divide-y divide-line">
            {pendingGuests.slice(0, 6).map((guest) => (
              <div key={guest.id} className="px-4 py-3">
                <p className="text-ink">{guest.name}</p>
                <p className="text-sm text-ink-soft">{guest.email ?? "No email"}</p>
              </div>
            ))}
          </Card>
        )}
      </section>

      <p className="text-sm text-ink-mute">
        Venue scouting, budget, and the run sheet stay under{" "}
        <span className="font-medium text-ink">Plan</span> — this dashboard is
        the people side.
      </p>
    </div>
  );
}
