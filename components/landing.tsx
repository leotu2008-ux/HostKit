import Image from "next/image";
import Link from "next/link";
import { CloudSky } from "@/components/cloud-sky";
import { ConnectAgentSection } from "@/components/connect-agent-section";
import { CreateEventButton } from "@/components/create-event-button";
import { Eyebrow } from "@/components/eyebrow";
import { GlitchText } from "@/components/glitch-text";
import { LandingPreview } from "@/components/landing-preview";
import { HostyMark } from "@/components/hosty-mark";
import { Reveal } from "@/components/reveal";
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

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      Host<span className="text-brand">y</span>
    </span>
  );
}

/** The hero's entrance order, as the `--i` custom property `.rise` reads. */
function stagger(i: number): React.CSSProperties {
  return { "--i": i } as React.CSSProperties;
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

/** Invite-only: strangers join the waitlist; a host with access plans an event. */
function PrimaryCta({ canCreate }: { canCreate: boolean }) {
  if (canCreate) {
    return (
      <CreateEventButton
        label={
          <>
            Plan an event <span aria-hidden>→</span>
          </>
        }
        variant="brand"
        size="lg"
      />
    );
  }
  return (
    <ButtonLink href="/signup" variant="brand" size="lg">
      Join the waitlist <span aria-hidden>→</span>
    </ButtonLink>
  );
}

export function Landing({ canCreate }: { canCreate: boolean }) {
  return (
    <main className="relative isolate -mt-16 flex-1 bg-paper md:-mt-[4.25rem]">
      {/* No header: the app shell already renders the nav and the brand. The
          negative margin (the floating bar's height) runs the sky up under
          the bar to the top edge; the matching padding below keeps the hero
          exactly where it was. */}
      {/* The sky spans exactly the hero and the preview: it is sized by this
          wrapper, not by a fixed height, so it ends where the preview does at
          every viewport width. */}
      <div className="relative isolate pt-16 md:pt-[4.25rem]">
      <CloudSky />
      <Rails>
        {/* The hero rises line by line on load (`.rise` in globals.css);
            `--i` is each line's place in the queue. */}
        <section className="pt-16 pb-20 text-center md:pt-24 md:pb-24">
          <p
            className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft"
            style={stagger(0)}
          >
            <HostyMark size={16} className="text-ink" />
            Meet Hosty, an agent for the whole event
          </p>

          <h1
            className="rise mt-7 text-[42px] leading-[1.08] text-ink md:text-[68px]"
            style={stagger(1)}
          >
            <GlitchText as="span" className="font-hero text-[#182038]">
              Plan the event.
            </GlitchText>
            <br />
            <GlitchText as="span" className="font-display tracking-[-0.03em] text-black">
              Let the agent do
            </GlitchText>
            <span className="font-display tracking-[-0.03em]"> </span>
            {/* Hosty pops out of "work." He's pinned to "the work." — kept whole
                so a phone wraps before it, not inside it — rather than to the
                line, so he stays beside the word wherever the headline breaks.
                (GlitchText is an inline-block, so a split mid-phrase would
                strand "work." on a line of its own.) */}
            <span className="relative inline-block">
              <GlitchText as="span" className="font-display tracking-[-0.03em] text-black">
                the work.
              </GlitchText>
              <HostyMark
                filled
                className="hosty-pop pointer-events-none absolute -top-[0.06em] -right-[0.94em] h-[0.86em] w-[0.86em] text-ink"
              />
            </span>
          </h1>

          <p
            className="rise mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft md:text-[19px]"
            style={stagger(2)}
          >
            Brief it once and it drafts the plan, writes to the venues, chases
            the quotes, tracks who&rsquo;s coming, and hands you a run sheet for
            the day. You approve. It does the rest.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center justify-center gap-2.5"
            style={stagger(3)}
          >
            <PrimaryCta canCreate={canCreate} />
          </div>
          <p className="rise mt-4 text-[13px] text-ink-mute" style={stagger(4)}>
            {canCreate
              ? "Brief it once. The agent takes it from there."
              : "Invite-only while we’re small. Join the waitlist and we’ll email you when you’re in."}
          </p>
        </section>

        {/* The preview. The reference shows a request and its response; this
            shows a brief and what the agent hands back for it — and plays
            the exchange through once it scrolls into view. */}
        <section className="rise pb-20 md:pb-24" style={stagger(5)}>
          <LandingPreview />
        </section>
      </Rails>
      </div>

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
              {STAGES.map((stage, i) => (
                <Reveal as="li" index={i} key={stage.step} className="flex gap-5">
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
                </Reveal>
              ))}
            </ol>
          </section>
        </Rails>
      </div>

      {/* After the four stages, still on the page ground so the section’s
          own surface cards stay as they are. */}
      <Rails>
        <Reveal>
          <ConnectAgentSection />
        </Reveal>
      </Rails>

      <Rails>
        <section className="py-16 md:py-24">
          <Eyebrow>Why you can leave it alone</Eyebrow>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((item, i) => (
              <Reveal
                as="li"
                index={i}
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
              </Reveal>
            ))}
          </ul>
        </section>

        <Reveal as="section" className="pb-24 text-center md:pb-32">
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
            <PrimaryCta canCreate={canCreate} />
            {canCreate ? null : (
              <ButtonLink href="/signin" variant="secondary" size="lg">
                Sign in
              </ButtonLink>
            )}
          </div>
        </Reveal>
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
              <Link href="/mcp" className="hover:text-ink">
                Connect an agent
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
