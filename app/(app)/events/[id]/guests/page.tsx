import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { guestPhone, verifiedPhone } from "@/lib/api/serialize";
import { formatPhone } from "@/lib/phone";
import { effectiveHeadcount, summarizeGuests } from "@/lib/guests";
import { updateGuestAction, removeGuestAction } from "@/lib/actions/guests";
import { checkInGuestAction, undoCheckInAction } from "@/lib/actions/checkin";
import { AddGuestsForm } from "@/components/add-guests-form";
import { RsvpLink } from "@/components/rsvp-link";
import { ProgressBar } from "@/components/progress-bar";
import {
  Badge,
  Card,
  EmptyState,
  SectionHeading,
  Select,
  type Tone,
} from "@/components/ui";
import type { RsvpStatus } from "@/generated/prisma/enums";

const RSVP_LABEL: Record<RsvpStatus, string> = {
  INVITED: "No reply yet",
  ATTENDING: "Coming",
  DECLINED: "Can't come",
  MAYBE: "Maybe",
  PENDING: "Requested",
  WAITLISTED: "Waitlist",
};

const RSVP_TONE: Record<RsvpStatus, Tone> = {
  INVITED: "neutral",
  ATTENDING: "forest",
  DECLINED: "danger",
  MAYBE: "amber",
  PENDING: "amber",
  WAITLISTED: "neutral",
};

export default async function GuestsPage({
  params,
}: PageProps<"/events/[id]/guests">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
    include: guestPhone,
  });

  const summary = summarizeGuests(guests);
  const head = effectiveHeadcount(event.guestCount, summary);

  return (
    <div className="space-y-8">
      <div className="grid gap-4">
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Planning for</p>
          <p className="font-display tabular mt-1 text-2xl text-ink">
            {head.count} guests
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {head.source === "planned"
              ? "Your figure from intake — add guests to refine it"
              : "Everyone who hasn't declined, including plus-ones"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Confirmed</p>
          <p className="font-display tabular mt-1 text-2xl text-ink">
            {summary.confirmedHeads}
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {summary.attending} yes · {summary.maybe} maybe ·{" "}
            {summary.declined} no
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Replies in</p>
          <p className="font-display tabular mt-1 text-2xl text-ink">
            {summary.responseRate}%
          </p>
          <ProgressBar className="mt-3" percent={summary.responseRate} tone="forest" />
          <p className="mt-2 text-sm text-ink-mute">
            {summary.awaiting} still to chase
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <AddGuestsForm eventId={event.id} />
      </Card>

      <section>
        <SectionHeading
          title="The list"
          hint={
            guests.length > 0
              ? "Each guest has their own RSVP link. HostKit doesn't send email — copy the link and share it however you normally would."
              : undefined
          }
        />

        {guests.length === 0 ? (
          <EmptyState
            title="No guests yet"
            body="Paste your list above and each guest gets their own RSVP link. Replies feed straight back into the headcount everything else is priced against."
          />
        ) : (
          <Card className="divide-y divide-line">
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{guest.name}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {guest.email ?? "No email"}
                    {verifiedPhone(guest.user) ? (
                      <>
                        {" · "}
                        <a href={`tel:${verifiedPhone(guest.user)}`} className="hover:text-ink">
                          {formatPhone(verifiedPhone(guest.user)!)}
                        </a>
                      </>
                    ) : null}
                    {guest.plusOnes > 0 ? ` · +${guest.plusOnes}` : ""}
                    {guest.dietary ? ` · ${guest.dietary}` : ""}
                  </p>
                </div>

                <Badge tone={RSVP_TONE[guest.rsvpStatus]}>
                  {RSVP_LABEL[guest.rsvpStatus]}
                </Badge>

                {/* The host can record a reply that arrived by text or in
                    person, which is how most of them actually arrive. */}
                <form action={updateGuestAction} className="flex gap-2">
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="guestId" value={guest.id} />
                  <input type="hidden" name="plusOnes" value={guest.plusOnes} />
                  <Select
                    name="rsvpStatus"
                    defaultValue={guest.rsvpStatus}
                    className="h-9 py-0 text-sm"
                    key={guest.rsvpStatus}
                  >
                    {(Object.keys(RSVP_LABEL) as RsvpStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {RSVP_LABEL[status]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="submit"
                    className="text-sm font-medium text-clay hover:underline"
                  >
                    Save
                  </button>
                </form>

                <RsvpLink token={guest.rsvpToken} />

                {guest.checkedInAt ? (
                  <form action={undoCheckInAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="guestId" value={guest.id} />
                    <button
                      type="submit"
                      className="min-h-11 text-sm font-medium text-amber"
                    >
                      Undo check-in
                    </button>
                  </form>
                ) : (
                  <form action={checkInGuestAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="guestId" value={guest.id} />
                    <button
                      type="submit"
                      className="min-h-11 text-sm font-medium text-forest"
                    >
                      Check in
                    </button>
                  </form>
                )}

                <form action={removeGuestAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="guestId" value={guest.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${guest.name}`}
                    className="text-sm text-ink-mute hover:text-danger"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
