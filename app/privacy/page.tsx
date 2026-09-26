import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description: "What Hosty collects, why, and who helps us run it.",
};

const CONTACT_EMAIL = "leowomc@gmail.com";

/**
 * The privacy policy, in plain language. It lists only what the code on main
 * actually collects and the services it actually calls — when a feature that
 * touches personal data ships (analytics, a new provider), update this page
 * in the same change.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-16 md:px-8 md:pt-14">
      <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[46px]">Privacy</h1>
      <p className="mt-3 text-[13px] text-ink-mute">Effective September 25, 2026</p>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
        Hosty is run by Leo Tu, operating as Hosty (&ldquo;we&rdquo;). This page explains what we collect
        when you use tryhosty.app or the Hosty iOS app, why, and who helps us run it. Questions go to{" "}
        <Email />.
      </p>

      <Section title="What we collect">
        <List>
          <li>
            <b>Waitlist.</b> Your name, email address, and the date you joined.
          </li>
          <li>
            <b>Your account.</b> Your name and email address, and your password, which we store only as a
            one-way hash. If you sign up with a .edu address, we note the school domain.
          </li>
          <li>
            <b>Optional profile details.</b> A photo, bio, company, school and class year, and X, LinkedIn,
            or Instagram handles, if you add them.
          </li>
          <li>
            <b>Optional phone number.</b> If you add one, we text you a one-time code to confirm it.
          </li>
          <li>
            <b>Your events.</b> What you enter about them: titles, descriptions, dates, city and address,
            guest counts, budgets, tasks, run sheets, notes, photos, and the vendors and venues you&rsquo;re
            working with (name, email, phone, website).
          </li>
          <li>
            <b>Your guest lists.</b> The names you add, and optionally each guest&rsquo;s email, phone,
            plus-ones, dietary notes, RSVP, and check-in time. Guests reply through a private link and
            don&rsquo;t need an account.
          </li>
          <li>
            <b>Security data.</b> Cookies that keep you signed in, and counts of sign-in and sign-up attempts
            by IP address and email, to stop password guessing and spam.
          </li>
          <li>
            <b>iOS notifications.</b> If you allow notifications in the iOS app, a device token so we can
            send them.
          </li>
        </List>
        <P>
          When you fill in an event&rsquo;s city, your browser may ask for your location to suggest the
          nearest city. That lookup happens in your browser; we save only the city you keep.
        </P>
        <P>We don&rsquo;t use advertising or cross-site tracking, and we don&rsquo;t sell personal information.</P>
      </Section>

      <Section title="How we use it">
        <List>
          <li>To run Hosty: your account, your events, guest lists, budgets, and RSVPs.</li>
          <li>To send the emails and texts you choose to send, such as guest updates and vendor inquiries.</li>
          <li>
            To send service messages: email confirmation, password resets, waitlist invitations, and
            event updates.
          </li>
          <li>To keep Hosty secure and fix problems.</li>
        </List>
        <P>
          When you message guests or vendors through Hosty, they see your name, your message, and your email
          address as the reply-to, so replies come straight to you.
        </P>
      </Section>

      <Section title="AI">
        <P>
          To rank venue options, Hosty sends event details to Anthropic&rsquo;s Claude API: the kind of event,
          city, guest count, timing, your description of the event, the venue budget, and the candidate
          venues. Hosty also uses Claude to draft a first plan and budget for a new event, and to word your
          daily digest. We may also send some of the same event details to TypeSafe&rsquo;s Jev model, through
          Vercel AI Gateway, for quick checks on those results.
        </P>
        <P>
          We don&rsquo;t send your guests&rsquo; names or contact details to these AI providers. Anything you
          type into an event&rsquo;s title or description may be included, so please keep sensitive personal
          information out of those fields. AI output is only a draft: Hosty never sends, publishes, or spends
          anything on its own.
        </P>
        <P>
          You can also connect your own AI assistant (such as Claude, ChatGPT, or Cursor) on the{" "}
          <Link href="/mcp" className="text-ink underline underline-offset-2">
            Connect an agent
          </Link>{" "}
          page. Those connections are read-only. A token connection can read your events and guest lists,
          including guests&rsquo; contact details. Once data reaches your assistant, its provider&rsquo;s
          privacy policy applies.
        </P>
      </Section>

      <Section title="Who helps us run Hosty">
        <List>
          <li>
            <b>Vercel</b>: hosting, and storage for photos you upload.
          </li>
          <li>
            <b>Supabase</b>: our database.
          </li>
          <li>
            <b>Anthropic</b>, and <b>TypeSafe</b> through Vercel AI Gateway: the AI features above.
          </li>
          <li>
            <b>Google Maps Platform (Places)</b>, or <b>Apple Maps</b> as a fallback: venue search. We send the
            search words and city, not your name or account.
          </li>
          <li>
            <b>Google (Gmail)</b>: sending email.
          </li>
          <li>
            <b>Twilio</b>: text messages, such as phone codes and guest updates you send by text.
          </li>
          <li>
            <b>Apple</b>: push notifications in the iOS app.
          </li>
        </List>
        <P>
          If you publish an event, anyone with its link can see the event page. If you register for a public
          event with your account, your first name and photo may appear in its &ldquo;who&rsquo;s going&rdquo;
          list unless you turn off &ldquo;Show me on guest lists&rdquo; in settings. We may also share
          information if the law requires it, or to protect people&rsquo;s safety.
        </P>
      </Section>

      <Section title="Guests and vendors">
        <P>
          If a host added you to a guest list or vendor list, the host decided to put your details in Hosty
          and is responsible for having the right to contact you. Please contact the host first; you can also
          email us at <Email />.
        </P>
      </Section>

      <Section title="Keeping and deleting your data">
        <P>
          We keep your information while your account is active, or until you or the host who added it
          removes it. To see, correct, or delete the information we hold about you, email <Email /> from the
          address on your account. We handle these requests by hand and may need to confirm who you are.
        </P>
      </Section>

      <Section title="Age">
        <P>You must be 18 or older to join the waitlist or use Hosty.</P>
      </Section>

      <Section title="Changes and governing law">
        <P>
          If we change this policy, we&rsquo;ll post the new version here with a new date. This policy is
          governed by the laws of the Commonwealth of Massachusetts.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Leo Tu, operating as Hosty. <Email />
        </P>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[22px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{children}</p>;
}

function List({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft [&_b]:font-medium [&_b]:text-ink">
      {children}
    </ul>
  );
}

function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
}
