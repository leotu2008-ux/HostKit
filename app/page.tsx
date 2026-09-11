import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";

const STEPS = [
  {
    step: "01",
    title: "Tell us about the event",
    body: "Type, date, headcount, city, budget. Six questions, about a minute.",
  },
  {
    step: "02",
    title: "Get a plan, not a blank page",
    body: "A timeline counted back from your date, a budget split across the categories your event actually needs, and a checklist of what's still unfilled.",
  },
  {
    step: "03",
    title: "Scout venues and vendors",
    body: "Every listing is priced against your event — your headcount, your hours, your budget. Not a directory of hourly rates you have to do maths on.",
  },
  {
    step: "04",
    title: "Shortlist, ask, book",
    body: "Compare your finalists side by side, send an inquiry with the details already filled in, and log the quote. Booking writes straight back into your budget and ticks off the task.",
  },
];

export default async function LandingPage() {
  if (await getCurrentUser()) redirect("/events");

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24">
          <p className="mb-4 text-sm font-medium tracking-wide text-clay uppercase">
            Plan your event end to end
          </p>
          <h1 className="font-display max-w-3xl text-4xl leading-[1.08] text-ink sm:text-6xl">
            Everything an event needs, in the order it needs it.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            HostKit turns six answers into a real plan — the timeline, the
            budget, and a shortlist of venues and vendors priced against your
            actual event. Then it keeps the whole thing in one place while you
            book it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">
              Plan an event
            </ButtonLink>
            <ButtonLink href="/signin" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {STEPS.map(({ step, title, body }) => (
                <li key={step} className="flex gap-5">
                  <span className="font-display tabular shrink-0 text-2xl text-clay">
                    {step}
                  </span>
                  <div>
                    <h3 className="font-display text-lg text-ink">{title}</h3>
                    <p className="mt-1.5 leading-relaxed text-ink-soft">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="rounded-card border border-line bg-forest px-7 py-12 text-center sm:px-12">
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              Your next event starts with six questions.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-forest-wash">
              No credit card, no vendor spam. Just a plan you can actually work
              from.
            </p>
            <div className="mt-7 flex justify-center">
              <ButtonLink href="/signup" size="lg">
                Get started
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <p className="mx-auto max-w-6xl px-5 text-sm text-ink-mute">
          HostKit — a demo project. Venue and vendor listings are invented
          sample data, not real businesses.
        </p>
      </footer>
    </>
  );
}
