import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { loadOutreach, type OutreachRow } from "@/lib/api/outreach";
import { vendorBookFor } from "@/lib/vendor-book";
import { OutreachCard } from "@/components/outreach-card";
import { AddCollaboratorForm } from "@/components/add-collaborator-form";
import { VendorBookCard } from "@/components/vendor-book-card";
import { ButtonLink, Card, EmptyState, SectionHeading } from "@/components/ui";

const SECTIONS: Array<{
  kind: OutreachRow["kind"];
  title: string;
  hint: string;
  add?: { name: string; detail: string; label: string };
}> = [
  {
    kind: "VENUE",
    title: "Venue",
    hint: "The place. Ask about the date, what the hire includes, and access for setup.",
    add: { name: "Venue", detail: "Address or note", label: "Add a venue" },
  },
  {
    kind: "SPEAKER",
    title: "Speakers",
    hint: "Anyone on stage. The draft asks about timing, AV and a bio.",
    add: { name: "Speaker", detail: "Talk title or role", label: "Add a speaker" },
  },
  {
    kind: "VENDOR",
    title: "Vendors",
    hint: "Catering, music, AV — inquiries you started from Scout.",
  },
  {
    kind: "COHOST",
    title: "Cohosts",
    hint: "People helping you run it.",
    add: { name: "Cohost", detail: "How they’re helping", label: "Add a cohost" },
  },
];

/** Everyone the host needs to reach, each with a first message drafted. */
export default async function OutreachPage({ params }: PageProps<"/events/[id]/outreach">) {
  const { id } = await params;
  const { event, user } = await requireEvent(id);
  const isOwner = user?.id === event.ownerId;
  const [vendorBook, onEvent, rows] = await Promise.all([
    isOwner && event.ownerId ? vendorBookFor(event.ownerId) : Promise.resolve([]),
    db.eventCollaborator.findMany({
      where: { eventId: event.id, vendorContactId: { not: null } },
      select: { vendorContactId: true },
    }),
    loadOutreach(event, user?.name ?? "the host"),
  ]);
  const onEventVendorContactIds = new Set(onEvent.map((c) => c.vendorContactId as string));
  const pending = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-ink">Outreach</h2>
          <p className="text-[13px] text-ink-mute">
            {rows.length === 0
              ? "Nobody lined up yet."
              : `${rows.length} to reach · ${pending} not yet asked`}
          </p>
        </div>
        <ButtonLink href={`/events/${event.id}/discover`} variant="secondary" size="sm">
          Scout vendors
        </ButtonLink>
      </div>

      {isOwner && vendorBook.length > 0 ? (
        <VendorBookCard eventId={event.id} entries={vendorBook} onEventVendorContactIds={onEventVendorContactIds} />
      ) : null}

      {SECTIONS.map((section) => {
        const group = rows.filter((r) => r.kind === section.kind);
        return (
          <section key={section.kind}>
            <SectionHeading title={section.title} hint={section.hint} />
            {group.length === 0 ? (
              section.kind === "VENDOR" ? (
                <EmptyState
                  title="No vendor inquiries yet"
                  body="Scout finds caterers, DJs and AV priced for this night, and drafts the inquiry for you."
                  action={
                    <ButtonLink href={`/events/${event.id}/discover`} size="sm">
                      Open Scout
                    </ButtonLink>
                  }
                />
              ) : null
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {group.map((row) => (
                  <OutreachCard key={row.id} row={row} eventId={event.id} />
                ))}
              </div>
            )}
            {section.add ? (
              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-[13px] font-medium text-clay [&::-webkit-details-marker]:hidden">
                  + {section.add.label}
                </summary>
                <Card className="mt-3 max-w-xl p-4">
                  <AddCollaboratorForm
                    eventId={event.id}
                    kind={section.kind as "VENUE" | "SPEAKER" | "COHOST"}
                    nameLabel={section.add.name}
                    detailLabel={section.add.detail}
                    submitLabel={section.add.label}
                  />
                </Card>
              </details>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
