import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { relativeTime } from "@/lib/activity-format";
import type { CollaboratorStatus } from "@/generated/prisma/enums";
import { VenueFinder } from "@/components/venue-finder";
import { Badge, Card, EmptyState, SectionHeading, type Tone } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/events/[id]/venue">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  return { title: `Venue · ${event.title}` };
}

const STATUS: Record<CollaboratorStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Not yet asked", tone: "neutral" },
  CONFIRMED: { label: "Confirmed", tone: "forest" },
  DECLINED: { label: "Declined", tone: "danger" },
};

/** Where the night happens: what's already lined up, and a way to find more. */
export default async function VenuePage({ params }: PageProps<"/events/[id]/venue">) {
  const { id } = await params;
  const { event, user } = await requireEvent(id);

  const venues = await db.eventCollaborator.findMany({
    where: { eventId: event.id, kind: "VENUE" },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading title="Your venue" />
        {venues.length === 0 ? (
          <EmptyState
            title="No venue yet"
            body="Find one below, or add one by hand from Outreach."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {venues.map((venue) => {
              const contactBits = [
                venue.phone ? { label: venue.phone, href: `tel:${venue.phone.replace(/[^\d+]/g, "")}` } : null,
                venue.website
                  ? { label: venue.website.replace(/^https?:\/\//, ""), href: venue.website }
                  : null,
              ].filter((bit): bit is { label: string; href: string } => bit !== null);

              return (
                <Card key={venue.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{venue.name}</p>
                      {venue.detail ? <p className="text-[13px] text-ink-soft">{venue.detail}</p> : null}
                      {contactBits.length > 0 ? (
                        <p className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
                          {contactBits.map((bit) => (
                            <a
                              key={bit.href}
                              href={bit.href}
                              className="text-clay hover:underline"
                              target={bit.href.startsWith("http") ? "_blank" : undefined}
                              rel="noreferrer"
                            >
                              {bit.label}
                            </a>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={STATUS[venue.status].tone}>{STATUS[venue.status].label}</Badge>
                  </div>
                  {venue.sentAt ? (
                    <p className="mt-2 text-[13px] text-ink-mute">
                      Asked {relativeTime(venue.sentAt.toISOString(), now)}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Find one" />
        <VenueFinder event={event} hostName={user?.name || "the host"} />
      </section>
    </div>
  );
}
