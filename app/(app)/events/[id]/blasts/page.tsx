import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { phoneRecipientsFor, recipientsFor, SEGMENT_KEYS, SEGMENTS, type Segment } from "@/lib/blasts";
import { isEmailConfigured } from "@/lib/email/send";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { BlastComposer } from "@/components/blast-composer";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";

/** Email the guest list: compose to a segment, and see what's gone out. */
export default async function BlastsPage({ params }: PageProps<"/events/[id]/blasts">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const [guests, blasts] = await Promise.all([
    db.guest.findMany({
      where: { eventId: event.id },
      select: {
        name: true,
        email: true,
        rsvpStatus: true,
        user: { select: { phone: true, phoneVerifiedAt: true } },
      },
    }),
    db.blast.findMany({ where: { eventId: event.id }, orderBy: { sentAt: "desc" } }),
  ]);
  const counts = Object.fromEntries(
    SEGMENT_KEYS.map((key) => [key, recipientsFor(key, guests).length]),
  ) as Record<Segment, number>;
  const phoneCounts = Object.fromEntries(
    SEGMENT_KEYS.map((key) => [key, phoneRecipientsFor(key, guests).length]),
  ) as Record<Segment, number>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <SectionHeading
          title="Send an update"
          hint="Goes to the email each guest registered with. Reply-to is you."
        />
        <Card className="p-5">
          <BlastComposer
            eventId={event.id}
            eventTitle={event.title}
            counts={counts}
            phoneCounts={phoneCounts}
            canSend={isEmailConfigured()}
            canText={isSmsConfigured()}
          />
        </Card>
      </section>

      <aside>
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
                  {blast.sentAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </Card>
        )}
      </aside>
    </div>
  );
}
