import type { ListingCategory } from "@/generated/prisma/enums";
import type { ActivityLine } from "@/lib/activity";
import { db } from "@/lib/db";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { planningContext } from "@/lib/event-context";
import { composeInquiry, type OutreachEvent } from "@/lib/outreach";
import { isViable, scoreListing } from "@/lib/scoring";
import { draftInquiry } from "@/lib/inquiries";
import { NO_VENDORS_TITLE } from "@/lib/agent/steps";

/**
 * The agent's vendor step: for each category the plan allocated money to, the
 * best catalog listing in the event's city, with its first message written.
 *
 * "Best" is lib/scoring.ts's arithmetic, not a judgement call — price for
 * this event, capacity, lead time, all against the category's own allocation
 * — so the pick is explainable and the model isn't involved in it at all.
 *
 * Every inquiry lands DRAFT with no toEmail, through the same helper the
 * host's own "inquire" button uses. The host presses send; the agent never
 * does.
 */

export type VendorStepEvent = OutreachEvent & {
  id: string;
  owner: { name: string | null } | null;
};

export async function draftVendorInquiries(
  event: VendorStepEvent,
  categories: ListingCategory[],
): Promise<ActivityLine> {
  const context = await planningContext({
    id: event.id,
    guestCount: event.guestCount,
    durationHours: event.durationHours,
    date: event.date,
  });
  const hostName = event.owner?.name ?? "the host";
  const drafted: ListingCategory[] = [];

  for (const category of categories) {
    const [listings, allocation] = await Promise.all([
      db.listing.findMany({ where: { city: event.city, category } }),
      db.budgetCategory.findUnique({
        where: { eventId_category: { eventId: event.id, category } },
      }),
    ]);

    const best = listings
      .map((listing) => ({
        listing,
        fit: scoreListing(listing, context, allocation?.allocatedCents ?? null),
      }))
      // A listing that can't hold the party or wants more notice than there is
      // left isn't a near miss worth drafting to — see isViable.
      .filter(({ fit }) => isViable(fit))
      .sort((a, b) => b.fit.score - a.fit.score)[0];
    if (!best) continue;

    const { body } = composeInquiry(event, best.listing, hostName);
    await draftInquiry(event.id, best.listing.id, body);
    drafted.push(category);
  }

  if (drafted.length === 0) {
    // Nothing in the catalog fits this city and these dates. Worth a quiet
    // line rather than silence, so the host knows the step ran.
    return { actor: "agent", kind: "inquiries_drafted", title: NO_VENDORS_TITLE };
  }

  return {
    actor: "agent",
    kind: "inquiries_drafted",
    title: `${drafted.length} vendor ${drafted.length === 1 ? "inquiry" : "inquiries"} drafted`,
    body: drafted.map((category) => CATEGORY_LABEL[category]).join(" · "),
    href: `/events/${event.id}/outreach`,
  };
}
