import { db } from "@/lib/db";

/** Someone going, as the public page shows them: a first name and a face. */
export type Attendee = { id: string; firstName: string; imageUrl: string | null };

export type AttendeesPreview = { attendees: Attendee[]; total: number };

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "Someone";
}

/**
 * "Ada, Grace and 12 others are going" — from the faces shown and the true
 * total (which includes people who've opted out of the list).
 */
export function goingSentence(names: string[], total: number): string {
  if (total === 0) return "Be the first to register";
  const shown = names.slice(0, 2);
  const rest = total - shown.length;
  const verb = total === 1 ? "is" : "are";
  if (shown.length === 0) return `${total} ${verb} going`;
  if (rest <= 0) return `${shown.join(" and ")} ${verb} going`;
  return `${shown.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"} are going`;
}

/**
 * The first few people going, for social proof on the event page: only
 * account registrations (host-typed names aren't people who chose to be
 * seen), only those who haven't opted out, earliest first.
 */
export async function attendeesPreview(eventId: string, take = 8): Promise<AttendeesPreview> {
  const [rows, total] = await Promise.all([
    db.guest.findMany({
      where: {
        eventId,
        rsvpStatus: "ATTENDING",
        userId: { not: null },
        user: { showOnGuestLists: true },
      },
      orderBy: [{ respondedAt: "asc" }, { createdAt: "asc" }],
      take,
      select: { id: true, name: true, user: { select: { imageUrl: true } } },
    }),
    db.guest.count({ where: { eventId, rsvpStatus: "ATTENDING" } }),
  ]);
  return {
    attendees: rows.map((g) => ({ id: g.id, firstName: firstNameOf(g.name), imageUrl: g.user?.imageUrl ?? null })),
    total,
  };
}
