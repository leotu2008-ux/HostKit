import type {
  CollaboratorSource,
  EventType,
  EventVisibility,
  TicketType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { generatePlan } from "@/lib/plan";

/** A venue picked on Create. Becomes the event's address and a VENUE
 *  collaborator the host can reach from the dashboard. */
export type VenuePick = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  externalId: string | null;
  lat: number | null;
  lng: number | null;
  source: CollaboratorSource;
};

export type NewEvent = {
  ownerId: string | null;
  claimToken: string | null;
  title: string;
  type: EventType;
  date: Date | null;
  durationHours: number;
  guestCount: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  budgetTotalCents: number;
  description: string | null;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  published: boolean;
  /** The host's school, so the night surfaces to that campus first. */
  schoolDomain: string | null;
  /** Optional — hosts who already have a place just type the address. */
  venue?: VenuePick | null;
};

/**
 * Creates an event with its generated budget and timeline, in one
 * transaction: an event that exists without its plan would show the host an
 * empty planner with no way to regenerate it.
 *
 * Lives outside `lib/actions` because "use server" files may only export
 * async actions, and both the web form and the iOS API need it.
 */
export async function createEventWithPlan(input: NewEvent) {
  const { venue, ...fields } = input;
  const plan = generatePlan({
    type: input.type,
    date: input.date,
    budgetTotalCents: input.budgetTotalCents,
  });

  return db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        ...fields,
        vibe: fields.description,
        // A picked venue is the address unless the host typed a different one.
        address: fields.address ?? venue?.address ?? null,
        lat: fields.lat ?? venue?.lat ?? null,
        lng: fields.lng ?? venue?.lng ?? null,
      },
    });

    if (venue) {
      await tx.eventCollaborator.create({
        data: {
          eventId: created.id,
          kind: "VENUE",
          name: venue.name,
          detail: venue.address,
          phone: venue.phone,
          website: venue.website,
          source: venue.source,
          externalId: venue.externalId,
          lat: venue.lat,
          lng: venue.lng,
        },
      });
    }

    await tx.budgetCategory.createMany({
      data: plan.categories.map((c) => ({
        eventId: created.id,
        category: c.category,
        name: c.name,
        allocatedCents: c.allocatedCents,
      })),
    });

    await tx.task.createMany({
      data: plan.tasks.map((t) => ({
        eventId: created.id,
        title: t.title,
        notes: t.notes ?? null,
        offsetDays: t.offsetDays,
        category: t.category ?? null,
        dueDate: t.dueDate,
      })),
    });

    return created;
  });
}
