import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";

/**
 * The page a stranger lands on.
 *
 * Signed-in hosts get the dashboard in app/page.tsx; this is the other half of
 * that branch. Nothing here queries the database — a landing page that waits
 * on Postgres to render its headline is a landing page people leave.
 *
 * Positioning: an agent that works the whole event-planning workflow, not a
 * listings site. The four stages below ARE the workflow, and each says what
 * the agent does at that stage.
 *
 * A note for whoever edits this next, because it matters more here than on a
 * normal marketing page: some of these lines describe an agent that is not
 * fully wired yet. lib/ai/plan-draft.ts exists and is tested but still has no
 * caller, so "the agent drafts the plan" is today the deterministic template
 * doing the drafting. Keep the copy ahead of the code deliberately, or pull
 * it back — but know which lines are which. See docs for the gap.
 */

const STAGES = [
  {
    step: "01",
    title: "Brief it",
    agent: "The agent drafts the plan",
    body: "Tell it what you're throwing, when, and for how many. It comes back with a timeline counted from the date, a budget split across what that kind of night actually needs, and the bookings you can't go without.",
  },
  {
    step: "02",
    title: "Source it",
    agent: "The agent does the outreach",
    body: "It writes the first message to each venue and vendor with everything they need to quote properly, sends it once you approve, and tells you who never came back.",
  },
  {
    step: "03",
    title: "Fill it",
    agent: "The agent watches the room",
    body: "One link collects RSVPs. Because it reads the door as well as the replies, it tells you the range likely to actually walk in — the number you order food against.",
  },
  {
    step: "04",
    title: "Run it",
    agent: "The agent runs the day",
    body: "A run sheet built from the plan, times you can move, and a door that scans people in. What happened feeds back into the next event's estimate.",
  },
];

const PRINCIPLES = [
  {
    title: "It knows yours isn't the only event",
    body: "It checks what else is on that night before you commit to a date — competing events at your campus or in your city.",
  },
  {
    title: "It drafts, you decide",
    body: "Nothing is sent, published or spent without you pressing the button. Every message is yours to edit first.",
  },
  {
    title: "It shows its work",
    body: "Every number says where it came from, and a plain heuristic sits underneath in case the model has nothing useful to add.",
  },
];

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      Host<span className="text-brand">Kit</span>
    </span>
  );
}

export function Landing() {
  return (
    <main className="relative isolate flex-1 bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(60%_90%_at_20%_0%,color-mix(in_srgb,var(--color-wash)_9%,transparent),transparent),radial-gradient(45%_70%_at_85%_0%,color-mix(in_srgb,var(--color-forest)_7%,transparent),transparent)]"
      />

      {/* No header: the app shell above already renders the nav and the brand.
          A second one stacked two wordmarks and two CTAs on top of each other. */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-16 pb-20 text-center md:px-8 md:pt-28 md:pb-24">
        <div className="flex items-center justify-center gap-2.5">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-[9px] ring-1 ring-line"
          />
          <Wordmark className="font-event text-[22px] leading-none text-ink" />
        </div>

        <p className="mt-7 inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft">
          An agent for the whole event
        </p>

        <h1 className="font-display mt-5 text-[44px] leading-[1.05] tracking-[-0.025em] text-ink md:text-[68px]">
          Plan the event.
          <br />
          <span className="text-ink-soft">Let the agent do the work.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft md:text-[19px]">
          Brief it once and it drafts the plan, writes to the venues, chases
          the quotes, tracks who&rsquo;s coming, and hands you a run sheet for
          the day. You approve. It does the rest.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/events/new" size="lg">
            Plan an event
          </ButtonLink>
          <ButtonLink href="/discover" variant="secondary" size="lg">
            See what&rsquo;s on
          </ButtonLink>
        </div>
        <p className="mt-4 text-[13px] text-ink-mute">
          Free to start. No account needed until you publish.
        </p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <h2 className="font-display text-center text-[28px] leading-tight text-ink md:text-[38px]">
            The agent works every stage
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[16px] leading-relaxed text-ink-soft">
            Not a chatbot bolted onto a form. It carries one event from the
            first idea to the last person through the door.
          </p>

          <ol className="mt-12 grid gap-10 md:grid-cols-2 md:gap-x-12">
            {STAGES.map((stage) => (
              <li key={stage.step} className="flex gap-5">
                <span className="font-event shrink-0 pt-1 text-[13px] tabular-nums text-brand">
                  {stage.step}
                </span>
                <div>
                  <h3 className="font-display text-[20px] text-ink">
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-[14px] font-medium text-brand">
                    {stage.agent}
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                    {stage.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 md:px-8 md:py-24">
        <ul className="grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map((item) => (
            <li
              key={item.title}
              className="rounded-card border border-line bg-surface p-6"
            >
              <h2 className="font-display text-[18px] leading-snug text-ink">
                {item.title}
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pb-24 text-center md:px-8 md:pb-32">
        <h2 className="font-display text-[30px] leading-tight text-ink md:text-[42px]">
          Give it a date and a headcount
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
          You&rsquo;ll have a plan before you close the tab.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/events/new" size="lg">
            Plan an event
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary" size="lg">
            Create an account
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-ink-mute md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 rounded-[6px] ring-1 ring-line"
            />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/discover" className="hover:text-ink">
              Discover
            </Link>
            <Link href="/campus" className="hover:text-ink">
              Campus
            </Link>
            <Link href="/signin" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
