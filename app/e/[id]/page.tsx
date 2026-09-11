import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canAccessEvent, getCurrentUser } from "@/lib/session";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { schoolFor } from "@/lib/schools";
import { formatCents } from "@/lib/money";
import { formatEventDate, formatEventTime } from "@/lib/when";
import { isPublicPageVisible } from "@/lib/listing";
import { CoverArt } from "@/components/cover-art";
import { RegisterForm } from "@/components/register-form";
import { MapsLink } from "@/components/maps-link";
import {
  DateTile,
  IconTile,
  InfoRow,
  PinIcon,
  TicketIcon,
} from "@/components/date-tile";

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

/** "7:30 PM – 11:30 PM", or just the length when no start time was set. */
function timeRange(date: Date | null, hours: number): string {
  if (!date) return `${hours} hours`;
  const hasClock = date.getHours() !== 12 || date.getMinutes() !== 0;
  if (!hasClock) return `${hours} hours`;
  const end = new Date(date.getTime() + hours * 3_600_000);
  return `${formatEventTime(date)} – ${formatEventTime(end)}`;
}

function HostedBy({ name, going }: { name: string | null; going: number }) {
  return (
    <div className="border-t border-line pt-5">
      <p className="text-[13px] font-medium text-ink-mute">Hosted by</p>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-clay to-amber text-[12px] font-semibold text-white">
          {(name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="font-medium text-ink">
          {name ?? "A host still signing in"}
        </span>
      </div>
      <p className="mt-4 text-[14px] text-ink-soft">
        <span className="tabular font-medium text-ink">{going}</span> going
      </p>
    </div>
  );
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
        where: { eventId: event.id, email: user.email, rsvpStatus: "ATTENDING" },
        select: { id: true },
      })
    : null;

  const school = schoolFor(event.schoolDomain);
  const going = event._count.guests;
  const spotsLeft = Math.max(0, event.guestCount - going);
  const canRegister = event.published && !alreadyGoing && spotsLeft > 0;
  const ticketLabel =
    event.ticketType === "PAID" ? formatCents(event.ticketPriceCents) : "Free";

  return (
    <main className="relative isolate flex-1 overflow-hidden">
      {/* The cover, blown up and blurred, tints the whole page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] scale-125 opacity-50 blur-3xl saturate-150 [mask-image:linear-gradient(to_bottom,black_30%,transparent)] dark:opacity-40"
      >
        <CoverArt id={event.id} title="" />
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pt-6 pb-32 md:grid-cols-[minmax(0,330px)_minmax(0,1fr)] md:gap-12 md:px-8 md:pt-12 md:pb-16">
        <aside className="space-y-6">
          <div className="aspect-square overflow-hidden rounded-2xl bg-sunk shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]">
            <CoverArt id={event.id} title={event.title} />
          </div>
          <div className="hidden md:block">
            <HostedBy name={event.owner?.name ?? null} going={going} />
          </div>
        </aside>

        <article className="min-w-0">
          <p className="text-[13px] font-medium text-ink-soft">
            {event.published
              ? event.visibility === "PUBLIC"
                ? "Public event"
                : "Unlisted event"
              : "Draft preview"}
            {" · "}
            {EVENT_TYPE_LABEL[event.type]}
            {school ? (
              <>
                {" · "}
                <span className="rounded-full bg-clay-wash px-2 py-0.5 text-[12px] font-medium text-clay-deep">
                  {school.name}
                </span>
              </>
            ) : null}
          </p>
          <h1 className="font-event mt-2 text-[36px] leading-[1.08] text-ink md:text-[50px]">
            {event.title}
          </h1>

          <div className="mt-7 space-y-4">
            <InfoRow
              tile={<DateTile date={event.date} />}
              title={formatEventDate(event.date, true) ?? "Date to be announced"}
              detail={timeRange(event.date, event.durationHours)}
            />
            <InfoRow
              tile={
                <IconTile>
                  <PinIcon />
                </IconTile>
              }
              title={
                event.address || event.lat != null ? (
                  <MapsLink
                    target={{
                      address: event.address,
                      lat: event.lat,
                      lng: event.lng,
                      label: event.title,
                    }}
                    className="hover:underline"
                  >
                    {event.address || event.city}
                  </MapsLink>
                ) : (
                  event.city
                )
              }
              detail={event.address ? event.city : undefined}
            />
            <InfoRow
              tile={
                <IconTile>
                  <TicketIcon />
                </IconTile>
              }
              title={ticketLabel}
              detail={`${spotsLeft} of ${event.guestCount} spots left`}
            />
          </div>

          <section
            id="register"
            className="mt-8 scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface/85 backdrop-blur"
          >
            <p className="border-b border-line bg-sunk/60 px-5 py-2.5 text-[13px] font-medium text-ink-soft">
              Registration
            </p>
            <div className="p-5">
              {!event.published ? (
                <p className="text-[15px] text-ink-soft">
                  This is a draft. Publish it from the dashboard before guests
                  can register.
                </p>
              ) : alreadyGoing ? (
                <p className="font-medium text-forest">
                  You’re registered. See you there.
                </p>
              ) : spotsLeft === 0 ? (
                <p className="font-medium text-amber">
                  This night is full. Ask the host about a waitlist.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-[15px] text-ink-soft">
                    Welcome! Register below to save your spot
                    {event.ticketType === "PAID"
                      ? ` — tickets are ${ticketLabel}, paid to the host`
                      : ""}
                    .
                  </p>
                  <RegisterForm
                    eventId={event.id}
                    defaultName={user?.name}
                    defaultEmail={user?.email}
                  />
                </>
              )}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="border-b border-line pb-2 text-[13px] font-medium text-ink-soft">
              About this event
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed whitespace-pre-line text-ink">
              {event.description ||
                event.vibe ||
                `${EVENT_TYPE_LABEL[event.type]} in ${event.city.split(",")[0]}.`}
            </p>
          </section>

          <div className="mt-10 md:hidden">
            <HostedBy name={event.owner?.name ?? null} going={going} />
          </div>

          {isOwner ? (
            <p className="mt-8 text-sm">
              <Link href={`/events/${event.id}`} className="font-medium text-clay">
                Manage this event →
              </Link>
            </p>
          ) : null}
        </article>
      </div>

      {canRegister ? (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{event.title}</p>
              <p className="text-[12px] text-ink-mute">
                {going} going · {ticketLabel}
              </p>
            </div>
            <a
              href="#register"
              className="inline-flex min-h-11 items-center rounded-full bg-clay px-6 text-sm font-medium text-white"
            >
              Register
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
