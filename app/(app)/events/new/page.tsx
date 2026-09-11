import { EventIntakeForm } from "@/components/event-intake-form";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create event" };

export default async function NewEventPage() {
  const user = await getCurrentUser();

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
      <EventIntakeForm signedIn={Boolean(user)} />
    </div>
  );
}
