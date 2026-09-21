import { db } from "@/lib/db";
import { currentProfile, requireEvent } from "@/lib/session";
import { describeMissing, missingBriefFields } from "@/lib/brief";
import { formatCents } from "@/lib/money";
import { splitStart } from "@/lib/when";
import { BriefForm } from "@/components/brief-form";
import { Card } from "@/components/ui";

// Server Actions inherit the page's route segment limit; Milestone 3 runs
// the agent from the save action via after(), which will need headroom
// beyond the 10s default.
export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<"/events/[id]/brief">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  return { title: `Brief · ${event.title}` };
}

/** Everything the agent needs to plan this night, in one form. */
export default async function BriefPage({ params }: PageProps<"/events/[id]/brief">) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  const profile = await currentProfile();

  // event.address is the source of truth once it's set; before then, an
  // existing VENUE collaborator (e.g. from before this brief existed) is the
  // fallback so a host doesn't see a blank field for a venue they already named.
  const venue = event.address
    ? null
    : await db.eventCollaborator.findFirst({
        where: { eventId: event.id, kind: "VENUE" },
        select: { name: true, detail: true },
      });

  const { date, time } = splitStart(event.date);
  const missing = missingBriefFields(event);
  const missingText = describeMissing(missing);

  return (
    <div className="space-y-6">
      <BriefForm
        event={{
          id: event.id,
          title: event.title,
          kind: event.kind ?? "",
          date,
          time,
          durationHours: event.durationHours,
          city: event.city,
          guestCount: event.guestCount,
          budget: event.budgetTotalCents > 0 ? formatCents(event.budgetTotalCents) : "",
          description: event.description ?? "",
          address: event.address || venue?.detail || venue?.name || "",
        }}
        hasSchool={Boolean(profile?.schoolDomain)}
      />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">What the agent still needs</h2>
        <p className="mt-1 text-[13px] text-ink-mute">
          {missing.length > 0
            ? `${missingText.charAt(0).toUpperCase()}${missingText.slice(1)}.`
            : "Saving this sets the agent going."}
        </p>
      </Card>
    </div>
  );
}
