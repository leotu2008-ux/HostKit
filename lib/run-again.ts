import type {
  CollaboratorKind,
  CollaboratorSource,
  EventType,
  EventVisibility,
  ListingCategory,
  RowSource,
  TicketType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { DAY_MS, startOfDay } from "@/lib/plan";

export type RerunSource = {
  id: string;
  ownerId: string | null;
  seriesId: string | null;
  title: string;
  type: EventType;
  kind: string | null;
  date: Date | null;
  endDate: Date | null;
  datesFlexible: boolean;
  durationHours: number;
  guestCount: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  budgetTotalCents: number;
  vibe: string | null;
  description: string | null;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  requiresApproval: boolean;
  coverUrl: string | null;
  schoolDomain: string | null;
  clubId: string | null;
  budgetCategories: { category: ListingCategory; name: string; allocatedCents: number; source: RowSource }[];
  tasks: { title: string; notes: string | null; offsetDays: number; category: ListingCategory | null; source: RowSource }[];
  runSheetItems: { startsAt: Date; title: string; owner: string | null; notes: string | null; source: RowSource }[];
  collaborators: {
    kind: CollaboratorKind;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    detail: string | null;
    source: CollaboratorSource;
    externalId: string | null;
    lat: number | null;
    lng: number | null;
    vendorContactId: string | null;
  }[];
};

export type RerunPlan = ReturnType<typeof planRerun>;

/** Moves a run-sheet time onto the new day: by the date gap, or, with no source date, keeping its time of day. */
function shiftTime(at: Date, from: Date | null, to: Date): Date {
  if (from) return new Date(at.getTime() + (to.getTime() - from.getTime()));
  const moved = new Date(to);
  moved.setHours(at.getHours(), at.getMinutes(), 0, 0);
  return moved;
}

/**
 * What "Run it again" writes, worked out without touching the database: the
 * brief, the budget split, the tasks (re-dated, back to TODO), the run sheet
 * (shifted) and the vendors (back to PENDING). Guests, inquiries, budget
 * items, blasts and the outcome stay with the original night.
 */
export function planRerun(source: RerunSource, date: Date) {
  return {
    event: {
      ownerId: source.ownerId,
      title: source.title,
      type: source.type,
      kind: source.kind,
      date,
      endDate:
        source.endDate && source.date
          ? new Date(source.endDate.getTime() + (date.getTime() - source.date.getTime()))
          : null,
      datesFlexible: source.datesFlexible,
      durationHours: source.durationHours,
      guestCount: source.guestCount,
      city: source.city,
      address: source.address,
      lat: source.lat,
      lng: source.lng,
      budgetTotalCents: source.budgetTotalCents,
      vibe: source.vibe,
      description: source.description,
      ticketType: source.ticketType,
      ticketPriceCents: source.ticketPriceCents,
      visibility: source.visibility,
      requiresApproval: source.requiresApproval,
      coverUrl: source.coverUrl,
      schoolDomain: source.schoolDomain,
      clubId: source.clubId,
      copiedFromId: source.id,
    },
    budgetCategories: source.budgetCategories.map((c) => ({
      category: c.category,
      name: c.name,
      allocatedCents: c.allocatedCents,
      source: c.source,
    })),
    tasks: source.tasks.map((t) => ({
      title: t.title,
      notes: t.notes,
      offsetDays: t.offsetDays,
      category: t.category,
      source: t.source,
      status: "TODO" as const,
      dueDate: startOfDay(new Date(date.getTime() - t.offsetDays * DAY_MS)),
    })),
    runSheetItems: source.runSheetItems.map((r) => ({
      title: r.title,
      owner: r.owner,
      notes: r.notes,
      source: r.source,
      startsAt: shiftTime(r.startsAt, source.date, date),
    })),
    collaborators: source.collaborators.map((c) => ({
      kind: c.kind,
      name: c.name,
      email: c.email,
      phone: c.phone,
      website: c.website,
      detail: c.detail,
      source: c.source,
      externalId: c.externalId,
      lat: c.lat,
      lng: c.lng,
      vendorContactId: c.vendorContactId,
      status: "PENDING" as const,
    })),
  };
}

/**
 * Runs an event again on a new date: copies it, puts both in one series
 * (creating it, named after the event, the first time) and returns the new id.
 */
export async function runEventAgain(sourceId: string, date: Date): Promise<string> {
  return db.$transaction(async (tx) => {
    const source = await tx.event.findUniqueOrThrow({
      where: { id: sourceId },
      include: {
        budgetCategories: true,
        tasks: { orderBy: { createdAt: "asc" } },
        runSheetItems: { orderBy: { startsAt: "asc" } },
        collaborators: true,
      },
    });
    if (!source.ownerId) throw new Error("Only an event with a host can be run again.");

    let seriesId = source.seriesId;
    if (!seriesId) {
      const series = await tx.series.create({ data: { ownerId: source.ownerId, name: source.title } });
      seriesId = series.id;
      await tx.event.update({ where: { id: source.id }, data: { seriesId } });
    }

    const plan = planRerun(source, date);
    const created = await tx.event.create({ data: { ...plan.event, seriesId }, select: { id: true } });
    const eventId = created.id;
    if (plan.budgetCategories.length) {
      await tx.budgetCategory.createMany({ data: plan.budgetCategories.map((c) => ({ ...c, eventId })) });
    }
    if (plan.tasks.length) await tx.task.createMany({ data: plan.tasks.map((t) => ({ ...t, eventId })) });
    if (plan.runSheetItems.length) {
      await tx.runSheetItem.createMany({ data: plan.runSheetItems.map((r) => ({ ...r, eventId })) });
    }
    if (plan.collaborators.length) {
      await tx.eventCollaborator.createMany({ data: plan.collaborators.map((c) => ({ ...c, eventId })) });
    }
    return eventId;
  });
}
