import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { scoreListing, type ListingFit } from "@/lib/scoring";
import { planningContext } from "@/lib/event-context";
import { formatCents, formatCentsCompact } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { ListingImage } from "@/components/listing-image";
import { SaveButton } from "@/components/save-button";
import {
  InquiryPanel,
  StartInquiryButton,
} from "@/components/inquiry-panel";
import { composeInquiry } from "@/lib/outreach";
import { INQUIRY_STATUS_LABEL } from "@/lib/catalog";
import { Badge, ButtonLink, Card, cx, type Tone } from "@/components/ui";

const UNIT_LABEL = {
  HOUR: "per hour",
  DAY: "per day",
  PERSON: "per person",
  FLAT: "flat fee",
} as const;

export async function generateMetadata({
  params,
}: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const listing = await db.listing.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: listing?.name ?? "Listing" };
}

export default async function ListingPage({
  params,
  searchParams,
}: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const eventId = Array.isArray(query.event) ? query.event[0] : query.event;

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) notFound();

  // The page works without an event — but with one it can say what this
  // listing actually costs you, which is the entire point.
  const user = await getCurrentUser();
  const event =
    user && eventId
      ? await db.event.findFirst({
          where: { id: eventId, ownerId: user.id },
        })
      : null;

  let fit: ListingFit | null = null;
  let saved = false;
  let inquiry = null as Awaited<
    ReturnType<typeof db.inquiry.findUnique>
  > | null;

  if (event) {
    [saved, inquiry] = await Promise.all([
      db.savedListing
        .findUnique({
          where: { eventId_listingId: { eventId: event.id, listingId: id } },
        })
        .then(Boolean),
      db.inquiry.findUnique({
        where: { eventId_listingId: { eventId: event.id, listingId: id } },
      }),
    ]);

    const allocation = await db.budgetCategory.findUnique({
      where: {
        eventId_category: { eventId: event.id, category: listing.category },
      },
    });
    fit = scoreListing(
      listing,
      await planningContext(event),
      allocation?.allocatedCents ?? null,
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {event ? (
        <Link
          href={`/events/${event.id}/discover`}
          className="mb-6 inline-block text-sm font-medium text-clay hover:underline"
        >
          ← Back to {event.title}
        </Link>
      ) : null}

      <div className="overflow-hidden rounded-card border border-line">
        <div className="aspect-[16/7]">
          <ListingImage
            listingId={listing.id}
            category={listing.category}
            name={listing.name}
          />
        </div>
      </div>

      <div className="mt-7 grid gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="clay">{CATEGORY_LABEL[listing.category]}</Badge>
            {listing.rating && listing.reviewCount >= 5 ? (
              <span className="text-sm text-ink-soft">
                ★ {listing.rating.toFixed(1)} ({listing.reviewCount} reviews)
              </span>
            ) : null}
          </div>

          <h1 className="font-display mt-3 text-3xl text-ink">{listing.name}</h1>
          <p className="mt-1 text-ink-soft">
            {listing.neighborhood ? `${listing.neighborhood}, ` : ""}
            {listing.city}
          </p>

          <p className="mt-6 leading-relaxed text-ink-soft">
            {listing.description}
          </p>

          {listing.capacityMin !== null || listing.capacityMax !== null ? (
            <p className="mt-4 text-ink-soft">
              Seats {listing.capacityMin ?? 1}–{listing.capacityMax} guests.
            </p>
          ) : null}

          {listing.amenities.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display mb-3 text-lg text-ink">
                What&rsquo;s here
              </h2>
              <ul className="flex flex-wrap gap-2">
                {listing.amenities.map((amenity) => (
                  <li key={amenity}>
                    <Badge>{amenity}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="mt-10 text-sm text-ink-mute">
            Needs at least {listing.leadTimeDays} days&rsquo; notice.
          </p>

          {event && inquiry ? (
            <section className="mt-10 border-t border-line pt-8">
              <h2 className="font-display mb-1 text-lg text-ink">
                Your inquiry
              </h2>
              <p className="mb-5 text-sm text-ink-soft">
                Student Events can&rsquo;t send this for you — copy it into your own
                email, then track what comes back here.
              </p>
              <InquiryPanel
                eventId={event.id}
                inquiry={inquiry}
                subject={
                  composeInquiry(event, listing, user?.name ?? "").subject
                }
              />
            </section>
          ) : null}
        </div>

        <aside>
          <Card className="p-5">
            {fit && event ? (
              <>
                <p className="text-sm text-ink-soft">For your event</p>
                <p className="font-display tabular mt-1 text-3xl text-ink">
                  {formatCents(fit.estimatedCents)}
                </p>
                <p className="mt-1 text-sm text-ink-mute">
                  {formatCentsCompact(listing.priceCents)}{" "}
                  {UNIT_LABEL[listing.priceUnit]} · {fit.priceBasis}
                </p>

                <dl className="mt-5 space-y-3 border-t border-line pt-5">
                  <FitRow
                    label="Capacity"
                    tone={
                      fit.capacity === "fits"
                        ? "forest"
                        : fit.capacity === "tight" || fit.capacity === "too_big"
                          ? "amber"
                          : fit.capacity === "too_small"
                            ? "danger"
                            : "neutral"
                    }
                    value={fit.capacityNote ?? "Not applicable"}
                  />
                  <FitRow
                    label="Budget"
                    tone={
                      fit.budget === "comfortable"
                        ? "forest"
                        : fit.budget === "stretch"
                          ? "amber"
                          : fit.budget === "over"
                            ? "danger"
                            : "neutral"
                    }
                    value={
                      fit.budgetSharePercent === null
                        ? "No budget set for this category"
                        : `${fit.budgetSharePercent}% of your ${CATEGORY_LABEL[
                            listing.category
                          ].toLowerCase()} allocation`
                    }
                  />
                  <FitRow
                    label="Timing"
                    tone={
                      fit.lead === "ok"
                        ? "forest"
                        : fit.lead === "tight"
                          ? "amber"
                          : fit.lead === "too_late"
                            ? "danger"
                            : "neutral"
                    }
                    value={
                      fit.leadNote ??
                      (fit.lead === "ok"
                        ? "Plenty of notice"
                        : "Add a date to check")
                    }
                  />
                </dl>

                <div className="mt-5 space-y-3 border-t border-line pt-5">
                  <SaveButton
                    eventId={event.id}
                    listingId={listing.id}
                    saved={saved}
                  />
                  {inquiry ? (
                    <p className="text-center text-sm text-ink-soft">
                      Inquiry status:{" "}
                      <span className="font-medium text-ink">
                        {INQUIRY_STATUS_LABEL[inquiry.status]}
                      </span>
                    </p>
                  ) : (
                    <StartInquiryButton
                      eventId={event.id}
                      listingId={listing.id}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">Headline rate</p>
                <p className="font-display tabular mt-1 text-3xl text-ink">
                  {formatCents(listing.priceCents)}
                </p>
                <p className="mt-1 text-sm text-ink-mute">
                  {UNIT_LABEL[listing.priceUnit]}
                </p>
                <p className="mt-5 border-t border-line pt-5 text-sm text-ink-soft">
                  Open this from one of your events to see what it actually
                  costs for your headcount, your hours and your budget.
                </p>
                <ButtonLink href="/events" variant="secondary" className="mt-4 w-full">
                  Go to my events
                </ButtonLink>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FitRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const dot: Record<Tone, string> = {
    neutral: "bg-ink-mute",
    clay: "bg-clay",
    forest: "bg-forest",
    amber: "bg-amber",
    danger: "bg-danger",
  };
  return (
    <div className="flex gap-3">
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", dot[tone])} />
      <div>
        <dt className="text-sm font-medium text-ink">{label}</dt>
        <dd className="text-sm text-ink-soft">{value}</dd>
      </div>
    </div>
  );
}
