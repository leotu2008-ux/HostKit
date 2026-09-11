import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessEvent } from "@/lib/session";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { formatEventDate, formatEventWhen } from "@/lib/when";
import { isPublicPageVisible } from "@/lib/listing";
import { CoverArt } from "@/components/cover-art";
import { RegisterForm } from "@/components/register-form";
import { MapsLink } from "@/components/maps-link";
import { Badge } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    select: { title: true, published: true, visibility: true },
  });
  if (!event || !isPublicPageVisible(event)) return { title: "Event" };
  return { title: event.title };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const event = await db.event.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
    },
  });
  if (!event) notFound();

  const isOwner = await canAccessEvent(event, user?.id ?? null);
  if (!isPublicPageVisible(event) && !isOwner) notFound();

  const alreadyGoing = user?.email
    ? await db.guest.findFirst({
        where: {
          eventId: event.id,
          email: user.email,
          rsvpStatus: "ATTENDING",
        },
        select: { id: true },
      })
    : null;

  const spotsLeft = Math.max(0, event.guestCount - event._count.guests);
  const place = event.address || event.city;
  const ticketLabel =
    event.ticketType === "PAID"
      ? formatCents(event.ticketPriceCents)
      : "Free";

  return (
    <main className="flex flex-1 flex-col pb-[7.5rem]">
      <div className="aspect-[16/9] overflow-hidden bg-sunk">
        <CoverArt id={event.id} title={event.title} />
      </div>

      <div className="px-5 pt-5">
        <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
          {event.published
            ? event.visibility === "PUBLIC"
              ? "Public"
              : "Unlisted"
            : "Draft preview"}{" "}
          · {EVENT_TYPE_LABEL[event.type]}
        </p>
        <h1 className="font-display mt-2 text-[32px] leading-[1.12] text-ink">
          {event.title}
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Hosted by {event.owner?.name ?? "a host still signing in"}
        </p>

        <dl className="mt-5 space-y-3 text-[15px]">
          <div>
            <dt className="text-[12px] font-medium tracking-[0.06em] text-ink-mute uppercase">
              When
            </dt>
            <dd className="mt-0.5 text-ink">
              {formatEventDate(event.date, true) ?? "Date to be announced"}
              <span className="block text-ink-soft">
                {event.durationHours} hours
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium tracking-[0.06em] text-ink-mute uppercase">
              Where
            </dt>
            <dd className="mt-0.5 text-ink">
              {event.address || event.lat != null ? (
                <MapsLink
                  target={{
                    address: event.address,
                    lat: event.lat,
                    lng: event.lng,
                    label: event.title,
                  }}
                  className="font-medium text-clay"
                >
                  {place}
                </MapsLink>
              ) : (
                event.city
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium tracking-[0.06em] text-ink-mute uppercase">
              Tickets
            </dt>
            <dd className="mt-0.5 text-ink">
              {ticketLabel}
              <span className="block text-ink-soft">
                {event.guestCount} capacity
              </span>
            </dd>
          </div>
        </dl>

        {event.description || event.vibe ? (
          <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
            {event.description || event.vibe}
          </p>
        ) : (
          <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
            {EVENT_TYPE_LABEL[event.type]} in {event.city.split(",")[0]}.{" "}
            {event.guestCount} spots.
          </p>
        )}

        {isOwner ? (
          <p className="mt-6 text-sm">
            <Link href={`/events/${event.id}`} className="font-medium text-clay">
              Open dashboard
            </Link>
          </p>
        ) : null}
      </div>

      <div className="no-print fixed right-0 bottom-0 left-0 z-40 mx-auto w-full max-w-[430px] border-t border-line bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{event.title}</p>
            <p className="truncate text-[12px] text-ink-mute">
              {formatEventWhen(event.date, event.durationHours)} · {place}
            </p>
          </div>
          <Badge tone={spotsLeft === 0 ? "amber" : "forest"}>
            {event._count.guests} / {event.guestCount} going
          </Badge>
        </div>
        {!event.published ? (
          <p className="rounded-full bg-sunk py-3 text-center text-sm font-medium text-ink-soft">
            Draft — sign in to publish before guests can register.
          </p>
        ) : alreadyGoing ? (
          <p className="rounded-full bg-forest-wash py-3 text-center text-sm font-medium text-forest">
            You’re registered
          </p>
        ) : spotsLeft === 0 ? (
          <p className="rounded-full bg-amber-wash py-3 text-center text-sm font-medium text-amber">
            This night is full
          </p>
        ) : (
          <details className="group">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-center rounded-full bg-clay text-base font-medium text-white [&::-webkit-details-marker]:hidden">
              {event.ticketType === "PAID"
                ? `Get a ticket · ${ticketLabel}`
                : "Register"}
            </summary>
            <div className="mt-3 rounded-card border border-line bg-surface p-4">
              <RegisterForm
                eventId={event.id}
                defaultName={user?.name}
                defaultEmail={user?.email}
              />
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
