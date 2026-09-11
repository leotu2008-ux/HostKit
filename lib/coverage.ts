import type { ListingCategory } from "@/generated/prisma/enums";
import { CATEGORY_LABEL } from "@/lib/catalog";

/**
 * "What does this event still need?"
 *
 * A category counts as covered once a booking exists against it. Inquiries
 * that are merely sent or quoted are explicitly NOT coverage — chasing a
 * caterer is not the same as having one, and a checklist that pretends
 * otherwise is worse than no checklist.
 */

export type BookingLike = {
  status: string;
  listing: { name: string; category: ListingCategory };
  quotedCents: number | null;
};

export type CoverageRow = {
  category: ListingCategory;
  label: string;
  required: boolean;
  bookedName: string | null;
  bookedCents: number | null;
  /** An inquiry is out but nothing is booked yet. */
  inFlight: boolean;
};

const IN_FLIGHT = new Set(["SENT", "REPLIED", "QUOTED"]);

export function computeCoverage(
  required: ListingCategory[],
  budgetCategories: ListingCategory[],
  inquiries: BookingLike[],
): CoverageRow[] {
  // Every category the plan funds is worth showing, with the required ones
  // first — those are what block the event from being ready.
  const requiredSet = new Set(required);
  const categories = [
    ...required,
    ...budgetCategories.filter((c) => !requiredSet.has(c)),
  ];

  return categories.map((category) => {
    const booked = inquiries.find(
      (i) => i.status === "BOOKED" && i.listing.category === category,
    );
    const inFlight = inquiries.some(
      (i) => IN_FLIGHT.has(i.status) && i.listing.category === category,
    );
    return {
      category,
      label: CATEGORY_LABEL[category],
      required: requiredSet.has(category),
      bookedName: booked?.listing.name ?? null,
      bookedCents: booked?.quotedCents ?? null,
      inFlight: !booked && inFlight,
    };
  });
}

/** Required categories with nothing booked — the real "not ready yet" list. */
export function outstandingRequired(rows: CoverageRow[]): CoverageRow[] {
  return rows.filter((r) => r.required && !r.bookedName);
}
