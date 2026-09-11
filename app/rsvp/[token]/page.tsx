import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { RsvpForm } from "@/components/rsvp-form";
import { Badge } from "@/components/ui";

export const metadata = {
  title: "You're invited",
  // An invitation link should not turn up in search results.
  robots: { index: false, follow: false },
};

/**
 * The guest's own page. No account, no sign-in — the token in the URL is the
 * authorisation. A guest who has to register to say "yes" doesn't say yes.
 */
export default async function RsvpPage({ params }: PageProps<"/rsvp/[token]">) {
  const { token } = await params;

  const guest = await db.guest.findUnique({
    where: { rsvpToken: token },
    include: {
      event: {
        select: {
          title: true,
          type: true,
          date: true,
          city: true,
          vibe: true,
        },
      },
    },
  });
  if (!guest) notFound();

  const { event } = guest;
  const replied = guest.rsvpStatus !== "INVITED";

  return (
    <main className="flex flex-1 flex-col items-center px-5 py-14">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-medium tracking-wide text-clay uppercase">
          {EVENT_TYPE_LABEL[event.type]}
        </p>
        <h1 className="font-display mt-3 text-center text-4xl leading-tight text-ink">
          {event.title}
        </h1>

        <div className="mt-5 space-y-1 text-center text-ink-soft">
          {event.date ? (
            <p>
              {event.date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : (
            <p>Date to be confirmed</p>
          )}
          <p>{event.city}</p>
        </div>

        {event.vibe ? (
          <p className="mt-5 text-center text-ink-soft italic">{event.vibe}</p>
        ) : null}

        <div className="mt-9 rounded-card border border-line bg-surface p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-ink">
              Hello <span className="font-medium">{guest.name}</span>
            </p>
            {replied ? <Badge tone="forest">Reply received</Badge> : null}
          </div>

          <RsvpForm
            token={token}
            current={guest.rsvpStatus}
            plusOnes={guest.plusOnes}
            dietary={guest.dietary}
            allowPlusOnes
          />
        </div>

        <p className="mt-6 text-center text-sm text-ink-mute">
          You can change your reply any time with this link.
        </p>
      </div>
    </main>
  );
}
