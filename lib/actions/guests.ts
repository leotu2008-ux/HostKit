"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { parseGuestList } from "@/lib/guests";
import { attendingHeads, promoteWaitlist, releasesSeat, seatFree } from "@/lib/waitlist";
import { newRsvpToken } from "@/lib/tokens";
import { record } from "@/lib/activity";
import { hasFinished } from "@/lib/outcomes";
import { inviteFromGuestBook, linkGuestsToContacts } from "@/lib/guest-book";

export type GuestFormState = { error?: string; added?: number } | undefined;

const RSVP_STATUSES = ["INVITED", "ATTENDING", "DECLINED", "MAYBE", "PENDING", "WAITLISTED"] as const;

export async function addGuestsAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEvent(eventId);

  const parsed = parseGuestList(String(formData.get("guests") ?? ""));
  if (parsed.length === 0) {
    return { error: "Add at least one name." };
  }

  // Skip anyone already on the list by email, so pasting an updated list
  // twice doesn't duplicate half the guests.
  const existing = await db.guest.findMany({
    where: { eventId, email: { not: null } },
    select: { email: true },
  });
  const known = new Set(existing.map((g) => g.email!.toLowerCase()));

  const fresh = parsed.filter(
    (guest) => !guest.email || !known.has(guest.email.toLowerCase()),
  );
  if (fresh.length === 0) {
    return { error: "Everyone on that list is already invited." };
  }

  await db.guest.createMany({
    data: fresh.map((guest) => ({
      eventId,
      rsvpToken: newRsvpToken(),
      name: guest.name,
      email: guest.email,
    })),
  });
  try {
    await linkGuestsToContacts(eventId);
  } catch (error) {
    console.error("linkGuestsToContacts failed", error);
  }

  refresh();
  return { added: fresh.length };
}

const updateSchema = z.object({
  rsvpStatus: z.enum(RSVP_STATUSES),
  plusOnes: z.coerce.number().int().min(0).max(20),
  dietary: z.string().max(300).optional(),
});

export async function updateGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  const parsed = updateSchema.safeParse({
    rsvpStatus: formData.get("rsvpStatus"),
    plusOnes: formData.get("plusOnes") ?? 0,
    dietary: formData.get("dietary") ?? undefined,
  });
  if (!parsed.success) return;

  const before = await db.guest.findFirst({
    where: { id: guestId, eventId },
    select: { rsvpStatus: true, plusOnes: true },
  });
  if (!before) return;

  await db.guest.updateMany({
    where: { id: guestId, eventId },
    data: {
      rsvpStatus: parsed.data.rsvpStatus,
      plusOnes: parsed.data.plusOnes,
      // The reply picker doesn't post dietary notes; recording a reply must
      // not wipe the guest's own (an allergy the caterer needs).
      ...(formData.has("dietary") ? { dietary: parsed.data.dietary?.trim() || null } : {}),
      respondedAt: parsed.data.rsvpStatus === "INVITED" ? null : new Date(),
    },
  });
  const plusOnes = { from: before.plusOnes, to: parsed.data.plusOnes };
  if (releasesSeat(before.rsvpStatus, parsed.data.rsvpStatus, plusOnes)) await promoteWaitlist(eventId);
  refresh();
}

export async function removeGuestAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const guestId = String(formData.get("guestId") ?? "");
  await requireEvent(eventId);

  const before = await db.guest.findFirst({ where: { id: guestId, eventId }, select: { rsvpStatus: true } });
  await db.guest.deleteMany({ where: { id: guestId, eventId } });
  if (before && releasesSeat(before.rsvpStatus, null)) await promoteWaitlist(eventId);
  refresh();
}

/**
 * The guest's own RSVP, submitted from the public page. Deliberately NOT
 * behind requireEvent: the token IS the authorisation, and a guest must never
 * need an account to reply to an invitation.
 *
 * Someone waiting on the host (a request, or the waitlist) can bow out from
 * here, but can't let themselves in — that's the host's call, or the line's.
 * Nor can a guest who declined jump the line by changing their mind, or
 * bring more people than there's room for.
 */
export async function submitRsvpAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const token = String(formData.get("token") ?? "");
  const parsed = updateSchema.safeParse({
    rsvpStatus: formData.get("rsvpStatus"),
    plusOnes: formData.get("plusOnes") ?? 0,
    dietary: formData.get("dietary") ?? undefined,
  });
  if (!parsed.success) return { error: "Pick whether you can make it." };
  if (parsed.data.rsvpStatus === "INVITED") {
    return { error: "Pick whether you can make it." };
  }

  const guest = await db.guest.findUnique({
    where: { rsvpToken: token },
    include: {
      event: { select: { date: true, endDate: true, durationHours: true, status: true, guestCount: true } },
    },
  });
  if (!guest) return { error: "This invitation link is no longer valid." };
  // After the night the list is history: a late "yes" would count as came in
  // the host's guest book, and a late "no" would erase someone who did.
  if (guest.event.status === "COMPLETED" || hasFinished(guest.event)) {
    return { error: "This night has already happened." };
  }

  const waiting = guest.rsvpStatus === "PENDING" || guest.rsvpStatus === "WAITLISTED";
  if (waiting && parsed.data.rsvpStatus !== "DECLINED") {
    return { error: "The host will confirm your spot — you can only step back from here." };
  }
  if (!waiting && (parsed.data.rsvpStatus === "PENDING" || parsed.data.rsvpStatus === "WAITLISTED")) {
    return { error: "Pick whether you can make it." };
  }

  const outcome = await db.$transaction(async (tx) => {
    // The same event-row lock registration and the waitlist take, so the room
    // counted here is still the room when the reply is written.
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${guest.eventId} FOR UPDATE`;

    // A guest who said no and changes their mind while people are waiting
    // joins the back of the line unless there's a seat nobody waiting fits:
    // they gave their seat up, and the waitlist was there first. An invite
    // (or a maybe) keeps its seat — the invite is the seat. A party too big
    // for the whole night isn't a line anyone waits behind.
    const rejoining =
      guest.rsvpStatus === "DECLINED" &&
      parsed.data.rsvpStatus === "ATTENDING" &&
      (await tx.guest.count({
        where: {
          eventId: guest.eventId,
          rsvpStatus: "WAITLISTED",
          plusOnes: { lte: guest.event.guestCount - 1 },
        },
      })) > 0 &&
      !(await seatFree(tx, guest.eventId, guest.event.guestCount, 1 + parsed.data.plusOnes));

    // Their own seat is theirs, but the people they bring need room — capacity
    // is people in the room. Plus-ones they already have stay once it fills.
    // Someone joining the line waits for room, but their party still has to
    // fit the night one day.
    const kept = guest.rsvpStatus === "ATTENDING" ? guest.plusOnes : 0;
    if (parsed.data.rsvpStatus === "ATTENDING" && parsed.data.plusOnes > kept) {
      const others = rejoining ? 0 : await attendingHeads(tx, guest.eventId, guest.id);
      const allowed = Math.max(kept, guest.event.guestCount - 1 - others);
      if (parsed.data.plusOnes > allowed) {
        return {
          error:
            allowed > 0
              ? `There’s only room for you and ${allowed} more.`
              : "The night is full, so there’s only room for you.",
        };
      }
    }

    await tx.guest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: rejoining ? "WAITLISTED" : parsed.data.rsvpStatus,
        // The line is ordered by createdAt, so rejoining it now puts them last.
        ...(rejoining ? { createdAt: new Date() } : {}),
        // Only an attending guest brings anyone with them.
        plusOnes:
          parsed.data.rsvpStatus === "ATTENDING" ? parsed.data.plusOnes : 0,
        dietary: parsed.data.dietary?.trim() || null,
        respondedAt: new Date(),
      },
    });
    return { rejoining };
  });
  if ("error" in outcome) return { error: outcome.error };
  const { rejoining } = outcome;
  const plusOnes = { from: guest.plusOnes, to: parsed.data.plusOnes };
  if (rejoining || releasesSeat(guest.rsvpStatus, parsed.data.rsvpStatus, plusOnes)) {
    await promoteWaitlist(guest.eventId);
  }

  // Only the move into ATTENDING (or back into line) is a new "yes" worth a
  // line — a guest can't pick PENDING or WAITLISTED themselves (guarded
  // above), and re-affirming an existing ATTENDING (e.g. editing dietary
  // notes) isn't a new decision.
  if (rejoining) {
    await record(guest.eventId, {
      actor: "system",
      kind: "guest_rsvp",
      title: `${guest.name} changed their mind and joined the waitlist`,
    });
  } else if (parsed.data.rsvpStatus === "ATTENDING" && guest.rsvpStatus !== "ATTENDING") {
    await record(guest.eventId, { actor: "system", kind: "guest_rsvp", title: `${guest.name} is going` });
  }

  refresh();
  return undefined;
}

/** Invites people from the host's guest book. The owner's contacts only. */
export async function inviteFromGuestBookAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event, user } = await requireEvent(eventId);
  if (!event.ownerId || user?.id !== event.ownerId) return { error: "Only the host can do that." };
  const contactIds = formData.getAll("contactId").map(String).filter(Boolean);
  if (contactIds.length === 0) return { error: "Pick at least one person." };
  const added = await inviteFromGuestBook(event.id, event.ownerId, contactIds);
  if (added === 0) return { error: "Everyone you picked is already on the list." };
  refresh();
  return { added };
}
