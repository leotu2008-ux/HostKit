import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import {
  blastDraft,
  isBlastDraftKind,
  phoneRecipientsFor,
  recipientsFor,
  segmentsFor,
  SEGMENTS,
  type Segment,
} from "@/lib/blasts";
import { isEmailConfigured } from "@/lib/email/send";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { BlastComposer } from "@/components/blast-composer";
import { LocalTime } from "@/components/local-time";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";

/** Email the guest list: compose to a segment, and see what's gone out.
 *  `?draft=nudge|reminder` (from a briefing card) starts the composer on that
 *  drafted message; the host still edits and sends it. */
export default async function BlastsPage({ params, searchParams }: PageProps<"/events/[id]/blasts">) {
  const { id } = await params;
  const { draft: draftParam } = await searchParams;
  const { event } = await requireEvent(id);
  const draftKind = isBlastDraftKind(draftParam) ? draftParam : null;
  const draft = draftKind ? blastDraft(draftKind, event) : undefined;

  const [guests, blasts] = await Promise.all([
    db.guest.findMany({
      where: { eventId: event.id },
      select: {
        name: true,
        email: true,
        rsvpStatus: true,
        checkedInAt: true,
        user: { select: { phone: true, phoneVerifiedAt: true } },
      },
    }),
    db.blast.findMany({ where: { eventId: event.id }, orderBy: { sentAt: "desc" } }),
  ]);
  const segments = segmentsFor(event, guests);
  const counts = Object.fromEntries(
    segments.map((key) => [key, recipientsFor(key, guests).length]),
  ) as Record<Segment, number>;
  const phoneCounts = Object.fromEntries(
    segments.map((key) => [key, phoneRecipientsFor(key, guests).length]),
  ) as Record<Segment, number>;

  return (
    // Stacked, not a page-width two-column grid — this tab shares a
    // narrower workspace column with the sidebar and agent rail (see
    // app/(app)/events/[id]/layout.tsx).
    <div className="space-y-8">
      <section>
        <SectionHeading
          title="Send an update"
          hint="Goes to the email each guest registered with. Reply-to is you."
        />
        <Card className="p-5">
          <BlastComposer
            key={draftKind ?? "blank"}
            eventId={event.id}
            eventTitle={event.title}
            segments={segments}
            counts={counts}
            phoneCounts={phoneCounts}
            canSend={isEmailConfigured()}
            canText={isSmsConfigured()}
            draft={draft}
          />
        </Card>
      </section>

      <section>
        <SectionHeading title="Sent" />
        {blasts.length === 0 ? (
          <EmptyState title="Nothing sent yet" body="Your updates will be listed here." />
        ) : (
          <Card className="divide-y divide-line">
            {blasts.map((blast) => (
              <div key={blast.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{blast.subject}</p>
                  <Badge tone={blast.provider === "resend" ? "forest" : "neutral"}>
                    {blast.provider === "resend" ? "Sent" : "Copied"}
                  </Badge>
                </div>
                <p className="text-[13px] text-ink-mute">
                  {SEGMENTS[blast.segment as Segment] ?? blast.segment} · {blast.recipientCount} emailed{blast.smsCount > 0 ? ` · ${blast.smsCount} texted` : ""} ·{" "}
                  <LocalTime iso={blast.sentAt.toISOString()} format="date" />
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
