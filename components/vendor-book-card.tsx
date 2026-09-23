import Link from "next/link";
import { addVendorFromBookAction } from "@/lib/actions/collaborators";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { AddVendorSubmit } from "@/components/add-vendor-submit";
import { Card } from "@/components/ui";
import type { VendorBookEntry } from "@/lib/vendor-book";

const KIND_LABEL = { VENUE: "Venue", SPEAKER: "Speaker", COHOST: "Cohost" } as const;

/** Vendors and venues this host has worked with, one click from this event. */
export function VendorBookCard({
  eventId,
  entries,
  onEventVendorContactIds,
}: {
  eventId: string;
  entries: VendorBookEntry[];
  /** Vendor-book ids already linked to a collaborator on this event — "Add to this event" hides for these. */
  onEventVendorContactIds: Set<string>;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Your vendor book</h2>
      <p className="mt-0.5 text-[13px] text-ink-mute">Venues and vendors you’ve confirmed or booked before.</p>
      <ul className="mt-3 divide-y divide-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink">{entry.name}</p>
              <p className="text-[12px] text-ink-mute">
                {entry.kind ? KIND_LABEL[entry.kind] : entry.category ? CATEGORY_LABEL[entry.category] : "Vendor"}
                {entry.email ? ` · ${entry.email}` : ""}
              </p>
            </div>
            {entry.kind ? (
              onEventVendorContactIds.has(entry.id) ? null : (
                <form action={addVendorFromBookAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="vendorContactId" value={entry.id} />
                  <AddVendorSubmit />
                </form>
              )
            ) : entry.listingId ? (
              <Link
                href={`/listings/${entry.listingId}?event=${eventId}`}
                className="text-sm font-medium text-clay hover:underline"
              >
                Ask again
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
