import { db } from "@/lib/db";
import { briefingFor, type Briefing } from "@/lib/agent/briefing";

/**
 * Loads the rows briefingFor needs for one event and hands them to it.
 *
 * The DB access lives here so briefingFor stays pure and unit-testable with
 * plain objects; this function itself is thin enough not to need its own
 * test (the codebase's convention for actions/routes/loaders that only wire
 * a pure function up to the database).
 */
export async function loadBriefing(
  event: { id: string; title: string; date: Date | null },
  now = new Date(),
): Promise<Briefing> {
  const [tasks, inquiries, collaborators] = await Promise.all([
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
    now,
  });
}
