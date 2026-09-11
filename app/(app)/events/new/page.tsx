import { EventIntakeForm } from "@/components/event-intake-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Plan an event" };

export default async function NewEventPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl text-ink">Plan an event</h1>
      <p className="mt-2 mb-10 max-w-xl text-ink-soft">
        Six questions. HostKit turns them into a timeline counted back from your
        date, a budget split across what this kind of event actually needs, and
        a checklist of what&rsquo;s still unfilled.
      </p>
      <EventIntakeForm />
    </div>
  );
}
