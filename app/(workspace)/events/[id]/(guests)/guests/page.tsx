import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { guestPhone, verifiedPhone } from "@/lib/api/serialize";
import { formatPhone } from "@/lib/phone";
import { effectiveHeadcount, summarizeGuests, turnoutReplies } from "@/lib/guests";
import { predictTurnout, showHistoryFor } from "@/lib/turnout";
import { daysUntil } from "@/lib/plan";
import { conflictCountFor } from "@/lib/campus/conflicts";
import { updateGuestAction, removeGuestAction } from "@/lib/actions/guests";
import { checkInGuestAction, undoCheckInAction } from "@/lib/actions/checkin";
import { guestBookFor } from "@/lib/guest-book";
import { AddGuestsForm } from "@/components/add-guests-form";
import { GuestBookPicker } from "@/components/guest-book-picker";
import { RsvpLink } from "@/components/rsvp-link";
import { SendInvitesForm } from "@/components/send-invites-form";
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
  const { event, user } = await requireEvent(id);
  const isOwner = user?.id === event.ownerId;
  const guestBook = isOwner && event.ownerId ? await guestBookFor(event.ownerId, event.id) : [];

  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
    include: guestPhone,
  });

  const summary = summarizeGuests(guests);
  const head = effectiveHeadcount(event.guestCount, summary);

  // How many of them actually turn up, which is a different question and the
  // one that decides how much food to order. A crowded campus night costs a
  // little of it, so the two queries go together.
  const [history, conflicts] = await Promise.all([
    showHistoryFor({
      ownerId: event.ownerId,
      schoolDomain: event.schoolDomain,
    }),
    conflictCountFor(event.schoolDomain, event.date),
  ]);
  const turnout = predictTurnout({
    ...turnoutReplies(summary),
    capacity: event.guestCount,
    daysUntil: daysUntil(event.date),
    conflicts,
    history,
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4">
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Planning for</p>
          <p className="tabular mt-1 text-[20px] font-semibold text-ink">
            {head.count} guests
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {head.source === "planned"
              ? "Your figure from intake — add guests to refine it"
              : "Everyone who hasn't declined, including plus-ones"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Likely through the door</p>
          <p className="tabular mt-1 text-[20px] font-semibold text-ink">
            {turnout.low}–{turnout.high}
          </p>
          <p className="mt-1 text-sm text-ink-mute">{turnout.basis.join(" ")}</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Confirmed</p>
          <p className="tabular mt-1 text-[20px] font-semibold text-ink">
            {summary.confirmedHeads}
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {summary.attending} yes · {summary.maybe} maybe ·{" "}
            {summary.declined} no
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-soft">Replies in</p>
          <p className="tabular mt-1 text-[20px] font-semibold text-ink">
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

      {isOwner && guestBook.length > 0 ? (
        <Card className="p-5">
          <GuestBookPicker eventId={event.id} entries={guestBook} />
        </Card>
      ) : null}

      <section>
        <SectionHeading
          title="The list"
          hint={
            guests.length > 0
              ? isOwner
                ? "Each guest has their own RSVP link. Send invites to email it, or copy a link."
                : "Each guest has their own RSVP link. Copy a link to share it."
              : undefined
          }
        />

        {isOwner && guests.length > 0 ? <SendInvitesForm eventId={event.id} /> : null}

        {guests.length === 0 ? (
          <EmptyState
            title="No guests yet"
            body="Paste your list above and each guest gets their own RSVP link. Send invites when you want that link emailed. Replies feed straight back into the headcount everything else is priced against."
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

                {isOwner && guest.email ? (
                  <SendInvitesForm eventId={event.id} guestId={guest.id} guestName={guest.name} />
                ) : null}

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
