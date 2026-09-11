import { EventIntakeForm } from "@/components/event-intake-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Create event" };

export default async function NewEventPage() {
  await requireUser();

  return (
    <div className="px-4 py-6">
      <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
        Create
      </p>
      <h1 className="font-display mt-1 text-[28px] leading-tight text-ink">
        Plan a night
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-ink-soft">
        Six questions plus a publish toggle. HostKit builds the timeline and
        budget; Discover is optional until you list it.
      </p>
      <EventIntakeForm />
    </div>
  );
}
