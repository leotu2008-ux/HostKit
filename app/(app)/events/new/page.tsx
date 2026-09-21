import { CreateEventButton } from "@/components/create-event-button";

export const metadata = { title: "Create event" };

/**
 * The only thing this page does is hand you the Create event button — the
 * button itself does the writing (lib/actions/events.ts
 * createBlankEventAction), so a GET here (a crawler, a link preview) can
 * never mint an event.
 */
export default function NewEventPage() {
  return (
    <div className="px-4 py-6 md:py-4">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">
        Create event
      </h1>
      <p className="mt-1 mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Start a night — tell the agent the basics and it drafts the plan,
        finds the venue and writes the first messages. You press send.
      </p>
      <CreateEventButton size="lg" />
    </div>
  );
}
