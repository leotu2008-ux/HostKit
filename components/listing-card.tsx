import Link from "next/link";
import type { ListingCategory, ListingKind, PriceUnit } from "@/generated/prisma/enums";
import type { ListingFit } from "@/lib/scoring";
import { formatCents, formatCentsCompact } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { ListingImage } from "@/components/listing-image";
import { Badge, cx, type Tone } from "@/components/ui";

export type ListingCardData = {
  id: string;
  name: string;
  kind: ListingKind;
  category: ListingCategory;
  neighborhood: string | null;
  city: string;
  priceCents: number;
  priceUnit: PriceUnit;
  capacityMax: number | null;
  rating: number | null;
  reviewCount: number;
};

const UNIT_SUFFIX: Record<PriceUnit, string> = {
  HOUR: "/hr",
  DAY: "/day",
  PERSON: "/head",
  FLAT: "",
};

/** The fit signal worth surfacing first, and how loudly. */
function headlineSignal(fit: ListingFit): { tone: Tone; text: string } | null {
  if (fit.capacity === "too_small") return { tone: "danger", text: fit.capacityNote! };
  if (fit.lead === "too_late") return { tone: "danger", text: fit.leadNote! };
  if (fit.capacity === "too_big") return { tone: "amber", text: fit.capacityNote! };
  if (fit.budget === "over") return { tone: "amber", text: "Over this category's budget" };
  if (fit.capacity === "tight") return { tone: "amber", text: fit.capacityNote! };
  if (fit.lead === "tight") return { tone: "amber", text: fit.leadNote! };
  if (fit.capacity === "fits") return { tone: "forest", text: fit.capacityNote! };
  return null;
}

export function ListingCard({
  listing,
  fit,
  href,
  action,
}: {
  listing: ListingCardData;
  fit: ListingFit;
  href: string;
  action?: React.ReactNode;
}) {
  const signal = headlineSignal(fit);
  const disqualified = fit.capacity === "too_small" || fit.lead === "too_late";

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong",
        disqualified && "opacity-70",
      )}
    >
      <Link href={href} className="block">
        <div className="aspect-[3/2] overflow-hidden bg-sunk">
          <ListingImage
            listingId={listing.id}
            category={listing.category}
            name={listing.name}
          />
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-ink">
              <Link href={href} className="after:absolute after:inset-0">
                {listing.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-ink-soft">
              {listing.kind === "VENUE"
                ? (listing.neighborhood ?? listing.city)
                : CATEGORY_LABEL[listing.category]}
              {listing.capacityMax ? ` · up to ${listing.capacityMax}` : ""}
            </p>
          </div>
          {listing.rating && listing.reviewCount >= 5 ? (
            <p className="tabular shrink-0 text-sm text-ink-soft">
              ★ {listing.rating.toFixed(1)}
            </p>
          ) : null}
        </div>

        {/* The point of the whole product: the price for THIS event, with the
            headline rate demoted to a footnote. */}
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-display tabular text-lg text-ink">
            {formatCents(fit.estimatedCents)}
          </p>
          <p className="text-sm text-ink-mute">for your {fit.priceBasis}</p>
        </div>
        <p className="mt-0.5 text-sm text-ink-mute">
          {formatCentsCompact(listing.priceCents)}
          {UNIT_SUFFIX[listing.priceUnit]}
          {fit.budgetSharePercent !== null
            ? ` · ${fit.budgetSharePercent}% of your ${CATEGORY_LABEL[
                listing.category
              ].toLowerCase()} budget`
            : ""}
        </p>

        {signal ? (
          <div className="mt-3">
            <Badge tone={signal.tone}>{signal.text}</Badge>
          </div>
        ) : null}

        {action ? <div className="relative z-10 mt-4">{action}</div> : null}
      </div>
    </article>
  );
}
