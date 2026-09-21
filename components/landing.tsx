import Image from "next/image";
import Link from "next/link";
import { CloudSky } from "@/components/cloud-sky";
import { GlitchText } from "@/components/glitch-text";
import { ButtonLink } from "@/components/ui";

/**
 * The front door, for everyone — app/page.tsx renders this signed in or out.
 *
 * Laid out after agent37.com/cloud: a narrow column held between hairline
 * rails, a pill over a two-tone headline, small-caps labels introducing each
 * section, and — the part that actually does the selling — a panel showing
 * what comes back, rather than a paragraph claiming it.
 *
 * Nothing here queries the database. A landing page that waits on Postgres to
 * render its headline is a landing page people leave.
 *
 * A note for whoever edits this next, because it matters more here than on a
 * normal marketing page: parts of this copy are ahead of the code.
 * lib/ai/plan-draft.ts is built and tested but still has no caller, so "the
 * agent drafts the plan" is the deterministic template doing the drafting
 * today. The preview panel below is labelled as an example for that reason —
 * it is representative of real output, not a screenshot of a live run. Keep
 * the copy ahead deliberately, or pull it back, but know which lines are which.
 */

const STAGES = [
  {
    step: "01",
    title: "Brief it",
    agent: "The agent drafts the plan",
    body: "Tell it what you're throwing, when, and for how many. It comes back with a timeline counted from the date, a budget split across what that kind of night needs, and the bookings you can't go without.",
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
    body: "A run sheet built from the plan, times you can move, and a door that scans people in. What happened feeds the next event's estimate.",
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

/** The brief on the left of the preview, as a host would type it. */
const BRIEF = [
  ["Kind", "Mixer"],
  ["When", "Thu 12 March, 8pm"],
  ["Guests", "120"],
  ["Budget", "$5,000"],
];

/** What comes back on the right. Representative of a real draft — the budget
 *  really is split by event kind, and the tasks really are counted back from
 *  the date — but written here rather than generated. */
const DRAFT_TASKS = [
  ["21 days out", "Lock the date, headcount and budget"],
  ["18 days out", "Book the room"],
  ["12 days out", "Confirm the guest cap with the venue"],
  ["6 days out", "Send invitations"],
  ["2 days out", "Confirm final headcount with the caterer"],
];

const DRAFT_BUDGET = [
  ["Venue", "$2,000"],
  ["Catering", "$1,500"],
  ["Music / DJ", "$1,000"],
  ["Decor", "$500"],
];

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      Host<span className="text-brand">Kit</span>
    </span>
  );
}

/** Small-caps section label, the way the reference introduces each block. */
function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-event text-[12px] tracking-[0.14em] text-ink-mute uppercase">
      {children}
    </p>
  );
}

/** Hairline rails down both sides of the column, so the page has structure
 *  without needing boxes around everything. */
function Rails({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl border-x border-line px-5 md:px-10">
      {children}
    </div>
  );
}

export function Landing() {
  return (
    <main className="relative isolate flex-1 bg-paper">
      <CloudSky />

      {/* No header: the app shell already renders the nav and the brand. */}
      <Rails>
        <section className="pt-16 pb-20 text-center md:pt-24 md:pb-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            An agent for the whole event
          </p>

          <h1 className="font-display mt-7 text-[42px] leading-[1.04] tracking-[-0.03em] text-ink md:text-[68px]">
            <GlitchText as="span">Plan the event.</GlitchText>
            <br />
            <GlitchText as="span" className="text-ink-mute">
              Let the agent do the work.
            </GlitchText>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft md:text-[19px]">
            Brief it once and it drafts the plan, writes to the venues, chases
            the quotes, tracks who&rsquo;s coming, and hands you a run sheet for
            the day. You approve. It does the rest.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            <ButtonLink href="/events/new" size="lg">
              Plan an event <span aria-hidden>→</span>
            </ButtonLink>
            <ButtonLink href="/discover" variant="secondary" size="lg">
              See what&rsquo;s on
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-ink-mute">
            Free to start. No account needed until you publish.
          </p>
        </section>

        {/* The preview. The reference shows a request and its response; this
            shows a brief and what the agent hands back for it. */}
        <section className="pb-20 md:pb-24">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <Eyebrow>You brief it</Eyebrow>
              <span className="text-[12px] text-ink-mute">Example</span>
            </div>

            <div className="grid gap-px bg-line md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <dl className="bg-surface p-5">
                {BRIEF.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 py-1.5"
                  >
                    <dt className="text-[13px] text-ink-mute">{label}</dt>
                    <dd className="text-[14px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="bg-surface p-5">
                <Eyebrow>It hands back</Eyebrow>

                <ul className="mt-3.5 space-y-1.5">
                  {DRAFT_TASKS.map(([when, task]) => (
                    <li key={task} className="flex gap-3 text-[14px]">
                      <span className="w-[92px] shrink-0 tabular-nums text-ink-mute">
                        {when}
                      </span>
                      <span className="text-ink">{task}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
                  {DRAFT_BUDGET.map(([category, amount]) => (
                    <span
                      key={category}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-soft"
                    >
                      {category}{" "}
                      <span className="tabular-nums font-medium text-ink">
                        {amount}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Rails>

      <div className="border-y border-line bg-surface">
        <Rails>
          <section className="py-16 md:py-24">
            <Eyebrow>The workflow</Eyebrow>
            <GlitchText
              as="h2"
              className="font-display mt-3 block max-w-2xl text-[28px] leading-tight text-ink md:text-[40px]"
            >
              The agent works every stage
            </GlitchText>
            <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-soft">
              Not a chatbot bolted onto a form. It carries one event from the
              first idea to the last person through the door.
            </p>

            <ol className="mt-12 grid gap-10 md:grid-cols-2 md:gap-x-12">
              {STAGES.map((stage) => (
                <li key={stage.step} className="flex gap-5">
                  <span className="font-event shrink-0 pt-1 text-[12px] tabular-nums text-brand">
                    {stage.step}
                  </span>
                  <div>
                    <GlitchText
                      as="h3"
                      className="font-display block text-[20px] text-ink"
                    >
                      {stage.title}
                    </GlitchText>
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
          </section>
        </Rails>
      </div>

      <Rails>
        <section className="py-16 md:py-24">
          <Eyebrow>Why you can leave it alone</Eyebrow>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <li
                key={item.title}
                className="rounded-card border border-line bg-surface p-6"
              >
                <GlitchText
                  as="h2"
                  className="font-display block text-[18px] leading-snug text-ink"
                >
                  {item.title}
                </GlitchText>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-24 text-center md:pb-32">
          <GlitchText
            as="h2"
            className="font-display block text-[30px] leading-tight text-ink md:text-[42px]"
          >
            Give it a date and a headcount
          </GlitchText>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
            You&rsquo;ll have a plan before you close the tab.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <ButtonLink href="/events/new" size="lg">
              Plan an event <span aria-hidden>→</span>
            </ButtonLink>
            <ButtonLink href="/signup" variant="secondary" size="lg">
              Create an account
            </ButtonLink>
          </div>
        </section>
      </Rails>

      <footer className="border-t border-line bg-surface">
        <Rails>
          <div className="flex flex-col items-center justify-between gap-4 py-8 text-[13px] text-ink-mute md:flex-row">
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
              <Link href="/events" className="hover:text-ink">
                My events
              </Link>
              <Link href="/discover" className="hover:text-ink">
                Discover
              </Link>
              <Link href="/signin" className="hover:text-ink">
                Sign in
              </Link>
            </nav>
          </div>
        </Rails>
      </footer>
    </main>
  );
}
