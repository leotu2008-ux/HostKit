import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { relativeTime } from "@/lib/activity-format";
import { EVENT_TYPE_LABEL, isCity } from "@/lib/catalog";
import { isVenueSearchConfigured } from "@/lib/venues/search";
import type { CollaboratorStatus } from "@/generated/prisma/enums";
import { VenueFinder } from "@/components/venue-finder";
import { ContactLinks } from "@/components/contact-links";
import { Badge, ButtonLink, Card, EmptyState, SectionHeading, type Tone } from "@/components/ui";

// Server Actions inherit the page's route segment limit; "Find venues" makes
// a Maps request and an up-to-8s model call, well past the 10s default.
export const maxDuration = 60;

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

/**
 * Where the night happens: what's already lined up, and a way to find more.
 *
 * Nothing on this page costs money to render. The search and the ranking are
 * a press, not a render (components/venue-finder.tsx) — the only thing
 * decided here is whether there's any point offering the button at all.
 */
export default async function VenuePage({ params }: PageProps<"/events/[id]/venue">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const venues = await db.eventCollaborator.findMany({
    where: { eventId: event.id, kind: "VENUE" },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  // Both halves of "is there anything to search": a configured provider, and
  // a city HostKit geocodes. Neither costs anything to ask.
  const scoutable = isVenueSearchConfigured() && isCity(event.city);

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
            {venues.map((venue) => (
              <Card key={venue.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{venue.name}</p>
                    {venue.detail ? <p className="text-[13px] text-ink-soft">{venue.detail}</p> : null}
                    <ContactLinks phone={venue.phone} website={venue.website} />
                  </div>
                  <Badge tone={STATUS[venue.status].tone}>{STATUS[venue.status].label}</Badge>
                </div>
                {venue.sentAt ? (
                  <p className="mt-2 text-[13px] text-ink-mute">
                    Asked {relativeTime(venue.sentAt.toISOString(), now)}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Find one" />
        {scoutable ? (
          <VenueFinder
            eventId={event.id}
            summary={`${EVENT_TYPE_LABEL[event.type]} for ${event.guestCount} in ${event.city.split(",")[0]}.`}
          />
        ) : (
          <EmptyState
            title="Venue search isn't switched on here"
            body="Add a venue by hand from Outreach instead."
            action={
              <ButtonLink href={`/events/${event.id}/outreach`} size="sm">
                Go to Outreach
              </ButtonLink>
            }
          />
        )}
      </section>
    </div>
  );
}
