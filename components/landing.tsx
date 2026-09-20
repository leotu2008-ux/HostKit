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
 * Every claim below maps to something the app actually does. No invented
 * metrics, no borrowed logos: there is no faster way to lose a host than to
 * promise them a product that isn't there when they sign up.
 */

const FEATURES = [
  {
    title: "A plan shaped to the night",
    body: "Say what you're throwing and get a timeline counted back from the date, a budget split across the things that night needs, and the bookings you can't go without.",
  },
  {
    title: "Know who'll actually turn up",
    body: "RSVPs tell you who said yes. HostKit watches the door too, so it gives you a range to order food against — and tells you where the number came from.",
  },
  {
    title: "Reach venues and vendors",
    body: "Drafts the first message with everything they need to quote you properly, sends it, and afterwards says which ones never came back.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Create it",
    body: "Name, time, place. You don't need an account until you publish.",
  },
  {
    step: "02",
    title: "Fill it",
    body: "Share one link. Collect RSVPs, approve who's coming, keep a waitlist.",
  },
  {
    step: "03",
    title: "Run it",
    body: "A run sheet for the day, and a door that scans people in.",
  },
];

function Wordmark() {
  return (
    <span className="font-event text-[22px] leading-none text-ink">
      Host<span className="text-brand">Kit</span>
    </span>
  );
}

export function Landing() {
  return (
    <main className="relative isolate flex-1">
      {/* The same wash the app uses, so the door and the house match. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(55%_90%_at_15%_0%,color-mix(in_srgb,var(--color-wash)_12%,transparent),transparent),radial-gradient(45%_80%_at_85%_0%,color-mix(in_srgb,var(--color-clay)_6%,transparent),transparent)]"
      />

      {/* No header here on purpose: the app shell above already renders the
          nav and the brand. A second one stacked two wordmarks and two
          "Create an event" buttons on top of each other. */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-16 pb-20 text-center md:px-8 md:pt-28 md:pb-28">
        <div className="flex items-center justify-center gap-2.5">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-[9px] ring-1 ring-line"
          />
          <Wordmark />
        </div>
        <h1 className="font-display mt-6 text-[44px] leading-[1.05] tracking-[-0.02em] text-ink md:text-[72px]">
          Simplifying events.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft md:text-[19px]">
          Everything a night takes — the plan, the budget, the venue, the guest
          list, the door — in one place, from the first idea to the last person
          through it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/events/new" size="lg">
            Create an event
          </ButtonLink>
          <ButtonLink href="/discover" variant="secondary" size="lg">
            See what&rsquo;s on
          </ButtonLink>
        </div>
        <p className="mt-4 text-[13px] text-ink-mute">
          Free to start. No account needed until you publish.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-card border border-line bg-surface p-6 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_30px_rgb(0_0_0/0.06)]"
            >
              <h2 className="font-display text-[19px] leading-snug text-ink">
                {feature.title}
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <h2 className="font-display text-center text-[28px] leading-tight text-ink md:text-[36px]">
            Three steps, start to finish
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step) => (
              <li key={step.step}>
                <p className="font-event text-[13px] tabular-nums text-brand">
                  {step.step}
                </p>
                <h3 className="font-display mt-2 text-[19px] text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-20 text-center md:px-8 md:py-28">
        <h2 className="font-display text-[30px] leading-tight text-ink md:text-[40px]">
          Your next night starts here
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
          Put in a date and a headcount. You&rsquo;ll have a plan before you
          close the tab.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/events/new" size="lg">
            Create an event
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary" size="lg">
            Create an account
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-ink-mute md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 rounded-[6px] ring-1 ring-line"
            />
            <span>
              Host<span className="text-brand">Kit</span>
            </span>
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
