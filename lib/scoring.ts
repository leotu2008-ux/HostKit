import type { PriceUnit } from "@/generated/prisma/enums";
import { percentOf } from "@/lib/money";
import { formatDurationLong } from "@/lib/when";

/**
 * Scoring a listing against ONE specific event.
 *
 * This is the difference between Hosty and a directory. A directory tells
 * you a venue is "$700/hour". A planner tells you it is "$4,200 for your six
 * hours, 27% of your venue budget, and it holds 90 people so you just fit".
 * Every card, filter and sort in discovery is built on the output of this
 * function, so it is pure and heavily tested.
 */

export type ScorableListing = {
  priceCents: number;
  priceUnit: PriceUnit;
  capacityMin: number | null;
  capacityMax: number | null;
  leadTimeDays: number;
  rating: number | null;
  reviewCount: number;
};

export type ScorableEvent = {
  guestCount: number;
  durationHours: number;
  /** Days until the event, or null if the host hasn't picked a date. */
  daysUntil: number | null;
};

export type CapacityFit = "fits" | "tight" | "too_small" | "too_big" | "unknown";
export type BudgetFit = "comfortable" | "stretch" | "over" | "unknown";
export type LeadFit = "ok" | "tight" | "too_late" | "unknown";

export type ListingFit = {
  /** What this listing costs for THIS event, not its headline rate. */
  estimatedCents: number;
  /** How that number was arrived at, in plain words. */
  priceBasis: string;
  capacity: CapacityFit;
  capacityNote: string | null;
  budget: BudgetFit;
  /** Share of this category's allocation, or null when nothing is allocated. */
  budgetSharePercent: number | null;
  lead: LeadFit;
  leadNote: string | null;
  /** 0-100. Higher is a better fit for this event. */
  score: number;
};

/** A venue at more than this share of its stated maximum is a squeeze. */
const TIGHT_CAPACITY_RATIO = 0.9;
/** Below this share of the category allocation, the price is comfortable. */
const COMFORTABLE_BUDGET_SHARE = 85;
const STRETCH_BUDGET_SHARE = 110;
/** Lead time within this multiple of the stated minimum is cutting it fine. */
const TIGHT_LEAD_RATIO = 1.5;

/** What this listing actually costs for this event. */
export function priceForEvent(
  listing: ScorableListing,
  event: ScorableEvent,
): { cents: number; basis: string } {
  switch (listing.priceUnit) {
    case "HOUR":
      return {
        // Durations are quarter hours, so round back to whole cents.
        cents: Math.round(listing.priceCents * event.durationHours),
        basis: formatDurationLong(event.durationHours),
      };
    case "PERSON":
      return {
        cents: listing.priceCents * event.guestCount,
        basis: `${event.guestCount} guests`,
      };
    case "DAY":
      return { cents: listing.priceCents, basis: "day rate" };
    case "FLAT":
      return { cents: listing.priceCents, basis: "flat fee" };
  }
}

function assessCapacity(
  listing: ScorableListing,
  guestCount: number,
): { fit: CapacityFit; note: string | null } {
  const { capacityMin, capacityMax } = listing;
  // Vendors have no capacity; they are constrained by lead time instead.
  if (capacityMax === null && capacityMin === null) {
    return { fit: "unknown", note: null };
  }

  if (capacityMax !== null && guestCount > capacityMax) {
    return {
      fit: "too_small",
      note: `Holds ${capacityMax} — you have ${guestCount}`,
    };
  }
  if (capacityMin !== null && guestCount < capacityMin) {
    return {
      fit: "too_big",
      note: `Takes a minimum of ${capacityMin}`,
    };
  }
  if (capacityMax !== null && guestCount > capacityMax * TIGHT_CAPACITY_RATIO) {
    return {
      fit: "tight",
      note: `Fits ${guestCount}, but only just — capacity ${capacityMax}`,
    };
  }
  return { fit: "fits", note: `Comfortable for ${guestCount}` };
}

function assessLead(
  listing: ScorableListing,
  daysUntil: number | null,
): { fit: LeadFit; note: string | null } {
  if (daysUntil === null) return { fit: "unknown", note: null };
  if (daysUntil < listing.leadTimeDays) {
    return {
      fit: "too_late",
      note: `Wants ${listing.leadTimeDays} days' notice — you have ${Math.max(0, daysUntil)}`,
    };
  }
  if (daysUntil < listing.leadTimeDays * TIGHT_LEAD_RATIO) {
    return { fit: "tight", note: "Book this one soon" };
  }
  return { fit: "ok", note: null };
}

export function scoreListing(
  listing: ScorableListing,
  event: ScorableEvent,
  allocatedCents: number | null,
): ListingFit {
  const { cents: estimatedCents, basis } = priceForEvent(listing, event);
  const { fit: capacity, note: capacityNote } = assessCapacity(
    listing,
    event.guestCount,
  );
  const { fit: lead, note: leadNote } = assessLead(listing, event.daysUntil);

  const budgetSharePercent =
    allocatedCents && allocatedCents > 0
      ? percentOf(estimatedCents, allocatedCents)
      : null;

  let budget: BudgetFit = "unknown";
  if (budgetSharePercent !== null) {
    budget =
      budgetSharePercent <= COMFORTABLE_BUDGET_SHARE
        ? "comfortable"
        : budgetSharePercent <= STRETCH_BUDGET_SHARE
          ? "stretch"
          : "over";
  }

  // Penalties, not bonuses: a listing starts as a perfect fit and loses points
  // for each way it doesn't work. That keeps the scale meaningful — 100 means
  // "nothing wrong with this", not "scored well on a curve".
  let score = 100;
  if (capacity === "too_small") score -= 70;
  else if (capacity === "too_big") score -= 35;
  else if (capacity === "tight") score -= 10;

  if (budget === "over") score -= 40;
  else if (budget === "stretch") score -= 12;

  if (lead === "too_late") score -= 50;
  else if (lead === "tight") score -= 10;

  // A well-reviewed listing edges ahead of an equally suitable one, but
  // reputation never rescues something that doesn't fit. Needs enough reviews
  // to mean anything.
  if (listing.rating !== null && listing.reviewCount >= 5) {
    score += Math.max(-5, Math.min(8, (listing.rating - 4.2) * 10));
  }

  return {
    estimatedCents,
    priceBasis: basis,
    capacity,
    capacityNote,
    budget,
    budgetSharePercent,
    lead,
    leadNote,
    score: Math.round(Math.max(0, Math.min(100, score))),
  };
}

/** True when a listing is disqualified rather than merely imperfect. */
export function isViable(fit: ListingFit): boolean {
  return fit.capacity !== "too_small" && fit.lead !== "too_late";
}
