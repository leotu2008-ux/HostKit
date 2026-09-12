import { EventIntakeForm } from "@/components/event-intake-form";
import { db } from "@/lib/db";
import { getCurrentUser, managedClubIds } from "@/lib/session";

export const metadata = { title: "Create event" };

export default async function NewEventPage({
  searchParams,
}: PageProps<"/events/new">) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const requested = Array.isArray(query.club) ? query.club[0] : query.club;

  // The clubs this person can post as. The form only offers these; the
  // action re-checks membership, so a forged id in the URL goes nowhere.
  const clubs = user
    ? await db.club.findMany({
        where: { id: { in: await managedClubIds(user.id) } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const defaultClubId = clubs.some((c) => c.id === requested) ? requested : undefined;

  return (
    <div className="px-4 py-6">
      <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
        Create
      </p>
      <h1 className="font-display mt-1 text-[28px] leading-tight text-ink">
        A night, on paper
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-ink-soft">
        Name, time, place, tickets. You can do this before you have an
        account — publishing is the step that needs a sign-in.
      </p>
      <EventIntakeForm
        signedIn={Boolean(user)}
        clubs={clubs}
        defaultClubId={defaultClubId}
      />
    </div>
  );
}
