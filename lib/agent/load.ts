import { db } from "@/lib/db";
import type { EventType } from "@/generated/prisma/enums";
import { briefingFor, type Briefing, type BriefingEvent } from "@/lib/agent/briefing";
import { loadDecisions } from "@/lib/ai/decide";
import { FALLBACK_TYPE } from "@/lib/brief";
import { typeCheckFrom } from "@/lib/brief-classify";
import { loadCompetitors } from "@/lib/night-competition";

/**
 * Loads the rows briefingFor needs for one event and hands them to it.
 *
 * The DB access lives here so briefingFor stays pure and unit-testable with
 * plain objects; this function itself is thin enough not to need its own
 * test (the codebase's convention for actions/routes/loaders that only wire
 * a pure function up to the database).
 */
export async function loadBriefing(
  event: BriefingEvent & {
    type?: EventType;
    kind?: string | null;
    city?: string;
    ownerId?: string | null;
    seriesId?: string | null;
  },
  now = new Date(),
): Promise<Briefing> {
  // Only an event still on the fallback type with words of its own can have
  // a type worth asking about, so only that one pays for the lookup.
  const askAboutType = event.type === FALLBACK_TYPE && Boolean(event.kind?.trim());
  const [tasks, inquiries, collaborators, guests, blasts, briefDecisions, competitors] = await Promise.all([
    db.task.findMany({
      where: { eventId: event.id, status: "TODO" },
      select: { id: true, title: true, dueDate: true, status: true, category: true },
    }),
    db.inquiry.findMany({
      where: { eventId: event.id },
      include: { listing: { select: { name: true, category: true } } },
    }),
    db.eventCollaborator.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        kind: true,
        name: true,
        email: true,
        status: true,
        sentAt: true,
        respondedAt: true,
      },
    }),
    db.guest.findMany({
      where: { eventId: event.id, rsvpStatus: { in: ["INVITED", "ATTENDING"] } },
      select: { name: true, email: true, rsvpStatus: true },
    }),
    db.blast.findMany({
      where: { eventId: event.id, segment: { in: ["pending", "going"] } },
      select: { segment: true, sentAt: true },
    }),
    askAboutType ? loadDecisions(event.id, "brief", { take: 1 }) : Promise.resolve([]),
    event.type && event.city
      ? loadCompetitors(
          {
            id: event.id,
            city: event.city,
            date: event.date,
            ownerId: event.ownerId ?? null,
            seriesId: event.seriesId ?? null,
            type: event.type,
            kind: event.kind ?? null,
          },
          now,
        )
      : Promise.resolve([]),
  ]);

  return briefingFor(event, {
    tasks,
    inquiries: inquiries.map((i) => ({
      id: i.id,
      name: i.listing.name,
      status: i.status,
      toEmail: i.toEmail,
      sentAt: i.sentAt,
      respondedAt: i.respondedAt,
      category: i.listing.category,
    })),
    collaborators,
    guests,
    blasts,
    typeCheck: askAboutType
      ? typeCheckFrom({ type: event.type!, kind: event.kind ?? null }, briefDecisions[0] ?? null)
      : null,
    competitors,
    now,
  });
}
