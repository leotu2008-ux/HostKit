import { db } from "@/lib/db";
import { startOfDay } from "@/lib/plan";
import { upcomingOnly } from "@/lib/upcoming";
import { loadBriefing } from "@/lib/agent/load";
import { digestNotice, worthNotifying } from "@/lib/agent/briefing";
import { phraseBriefing } from "@/lib/ai/briefing-voice";
import { notify } from "@/lib/notify";

/**
 * The daily "what needs you today" digest — modelled on completeFinishedEvents
 * (lib/outcomes.ts): find candidates, do the same pure work each one already
 * does for itself, act only where it matters, and be safe to run twice.
 *
 * The say-nothing rule lives one layer down, in worthNotifying — this never
 * mails a host just because a day passed.
 */

/** Only the first this many events per run get the model's phrasing; the
 *  rest get the deterministic digestNotice. Bounds how many model calls one
 *  cron invocation can make against maxDuration. */
const PHRASED_LIMIT = 100;

export type DigestResult = { events: number; notified: number; skipped: number };

export async function sendDailyBriefings(now = new Date()): Promise<DigestResult> {
  const candidates = await db.event.findMany({
    where: { status: { in: ["PLANNING", "CONFIRMED"] }, ownerId: { not: null }, ...upcomingOnly(now) },
    include: { club: { select: { members: { select: { userId: true } } } } },
    take: 500,
  });

  const recipientsFor = (event: (typeof candidates)[number]) =>
    [event.ownerId, ...(event.club?.members.map((m) => m.userId) ?? [])].filter(
      (id): id is string => Boolean(id),
    );

  const allRecipients = [...new Set(candidates.flatMap(recipientsFor))];

  // One up-front read of today's notifications rather than one query per
  // event: Notification has no schema change this milestone, so today's
  // agent_briefing rows are the only record of who has already been told.
  const already = await db.notification.findMany({
    where: { userId: { in: allRecipients }, createdAt: { gte: startOfDay(now) } },
    select: { userId: true, eventId: true, kind: true },
  });
  const alreadyNotified = new Set(
    already.filter((n) => n.kind === "agent_briefing").map((n) => `${n.userId}:${n.eventId}`),
  );

  let notified = 0;
  let skipped = 0;

  for (const event of candidates) {
    const recipients = recipientsFor(event).filter((id) => !alreadyNotified.has(`${id}:${event.id}`));
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const briefing = await loadBriefing(event, now);
    if (!worthNotifying(briefing)) {
      skipped += 1;
      continue;
    }

    const { notice } =
      notified < PHRASED_LIMIT
        ? await phraseBriefing(briefing, event.title, { eventDate: event.date, now })
        : { notice: digestNotice(briefing, event.title) };

    await notify(recipients, { kind: "agent_briefing", title: notice.title, body: notice.body, eventId: event.id });
    notified += 1;
  }

  return { events: candidates.length, notified, skipped };
}
