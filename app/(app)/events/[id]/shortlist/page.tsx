import Link from "next/link";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { scoreListing } from "@/lib/scoring";
import { daysUntil } from "@/lib/plan";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABEL, INQUIRY_STATUS_LABEL } from "@/lib/catalog";
import type { InquiryStatus, ListingCategory } from "@/generated/prisma/enums";
import { ListingImage } from "@/components/listing-image";
import { SaveButton } from "@/components/save-button";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeading,
  type Tone,
} from "@/components/ui";

const STATUS_TONE: Record<InquiryStatus, Tone> = {
  DRAFT: "neutral",
  SENT: "amber",
  REPLIED: "amber",
  QUOTED: "clay",
  BOOKED: "forest",
  DECLINED: "danger",
};

export default async function ShortlistPage({
  params,
}: PageProps<"/events/[id]/shortlist">) {
  const { id } = await params;
  const { event } = await requireEvent(id);

  const [saved, inquiries, budgetCategories] = await Promise.all([
    db.savedListing.findMany({
      where: { eventId: event.id },
      include: { listing: true },
      orderBy: { createdAt: "asc" },
    }),
    db.inquiry.findMany({ where: { eventId: event.id } }),
    db.budgetCategory.findMany({ where: { eventId: event.id } }),
  ]);

  const allocation = new Map(
    budgetCategories.map((c) => [c.category, c.allocatedCents]),
  );
  const inquiryByListing = new Map(inquiries.map((i) => [i.listingId, i]));
  const scorable = {
    guestCount: event.guestCount,
    durationHours: event.durationHours,
    daysUntil: daysUntil(event.date),
  };

  // Grouped by category, because the decision a host is actually making is
  // "which of these three venues", never "which of these 14 saved things".
  const groups = new Map<ListingCategory, typeof saved>();
  for (const row of saved) {
    const key = row.listing.category;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  if (saved.length === 0) {
    return (
      <EmptyState
        title="Nothing shortlisted yet"
        body="Save venues and vendors while you browse, then compare your finalists side by side here."
        action={
          <ButtonLink href={`/events/${event.id}/discover`}>
            Start scouting
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([category, rows]) => (
        <section key={category}>
          <SectionHeading
            title={CATEGORY_LABEL[category]}
            hint={`${rows.length} shortlisted · ${formatCents(
              allocation.get(category) ?? 0,
            )} allocated`}
            action={
              <Link
                href={`/events/${event.id}/discover?category=${category}`}
                className="text-sm font-medium text-clay hover:underline"
              >
                Find more
              </Link>
            }
          />

          {/* A comparison table, not a grid: the whole point is reading the
              same row across the options you are deciding between. */}
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="w-[34%] p-4 font-medium text-ink-soft">
                    Option
                  </th>
                  <th className="p-4 font-medium text-ink-soft">
                    Cost for your event
                  </th>
                  <th className="p-4 font-medium text-ink-soft">Fit</th>
                  <th className="p-4 font-medium text-ink-soft">Inquiry</th>
                  <th className="w-12 p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ listing, note }) => {
                  const fit = scoreListing(
                    listing,
                    scorable,
                    allocation.get(listing.category) ?? null,
                  );
                  const inquiry = inquiryByListing.get(listing.id);
                  return (
                    <tr key={listing.id} className="align-top">
                      <td className="p-4">
                        <div className="flex gap-3">
                          <div className="size-14 shrink-0 overflow-hidden rounded-lg">
                            <ListingImage
                              listingId={listing.id}
                              category={listing.category}
                              name={listing.name}
                            />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/listings/${listing.id}?event=${event.id}`}
                              className="font-medium text-ink hover:underline"
                            >
                              {listing.name}
                            </Link>
                            <p className="mt-0.5 text-ink-soft">
                              {listing.neighborhood ?? listing.city}
                            </p>
                            {note ? (
                              <p className="mt-1 text-ink-mute italic">
                                {note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="tabular font-medium text-ink">
                          {formatCents(fit.estimatedCents)}
                        </p>
                        <p className="mt-0.5 text-ink-mute">
                          for your {fit.priceBasis}
                        </p>
                        {fit.budgetSharePercent !== null ? (
                          <p className="mt-0.5 text-ink-mute">
                            {fit.budgetSharePercent}% of allocation
                          </p>
                        ) : null}
                      </td>

                      <td className="space-y-1.5 p-4">
                        {fit.capacityNote ? (
                          <Badge
                            tone={
                              fit.capacity === "fits"
                                ? "forest"
                                : fit.capacity === "too_small"
                                  ? "danger"
                                  : "amber"
                            }
                          >
                            {fit.capacityNote}
                          </Badge>
                        ) : null}
                        {fit.leadNote ? (
                          <Badge
                            tone={fit.lead === "too_late" ? "danger" : "amber"}
                          >
                            {fit.leadNote}
                          </Badge>
                        ) : null}
                        {fit.budget === "over" ? (
                          <Badge tone="danger">Over allocation</Badge>
                        ) : null}
                      </td>

                      <td className="p-4">
                        {inquiry ? (
                          <>
                            <Badge tone={STATUS_TONE[inquiry.status]}>
                              {INQUIRY_STATUS_LABEL[inquiry.status]}
                            </Badge>
                            {inquiry.quotedCents ? (
                              <p className="tabular mt-1.5 text-ink-soft">
                                Quoted {formatCents(inquiry.quotedCents)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <Link
                            href={`/listings/${listing.id}?event=${event.id}`}
                            className="font-medium text-clay hover:underline"
                          >
                            Draft one
                          </Link>
                        )}
                      </td>

                      <td className="p-4">
                        <SaveButton
                          eventId={event.id}
                          listingId={listing.id}
                          saved
                          variant="icon"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      ))}
    </div>
  );
}
