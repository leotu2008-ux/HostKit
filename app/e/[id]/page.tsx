import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { siteOrigin } from "@/lib/site";
import Link from "next/link";
import { db } from "@/lib/db";
import { canAccessEvent, getCurrentUser } from "@/lib/session";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { schoolFor } from "@/lib/schools";
import { registrationState } from "@/lib/registration";
import { attendingHeads, seatFree, waitlistPositionFor } from "@/lib/waitlist";
import { attendeesPreview, type Attendee } from "@/lib/attendees";
import { GoingRow } from "@/components/going-row";
import { Avatar } from "@/components/avatar";
import { formatCents } from "@/lib/money";
import { formatDurationLong, formatEventDate, formatEventTime } from "@/lib/when";
import { isPublicPageVisible } from "@/lib/listing";
import { hasFinished, hasStarted } from "@/lib/outcomes";
import { googleCalendarUrl } from "@/lib/calendar";
import { eventUrl } from "@/lib/promote";
import { AddToCalendar } from "@/components/add-to-calendar";
import { EventCover } from "@/components/event-cover";
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
  if (!date) return formatDurationLong(hours);
  const hasClock = date.getHours() !== 12 || date.getMinutes() !== 0;
  if (!hasClock) return formatDurationLong(hours);
  const end = new Date(date.getTime() + hours * 3_600_000);
  return `${formatEventTime(date)} – ${formatEventTime(end)}`;
}

function HostedBy({
  name,
  club,
  preview,
}: {
  name: string | null;
  club: { handle: string; name: string; imageUrl: string | null } | null;
  preview: { attendees: Attendee[]; total: number };
}) {
  return (
    <div className="border-t border-line pt-5">
      <p className="text-[13px] font-medium text-ink-mute">Hosted by</p>
      {club ? (
        <div className="mt-2.5 flex items-center gap-3">
          <Avatar name={club.name} imageUrl={club.imageUrl} size={32} className="rounded-lg" />
          <span className="block min-w-0 truncate font-medium text-ink">{club.name}</span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ink-soft to-ink text-[12px] font-semibold text-paper">
            {(name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="font-medium text-ink">
            {name ?? "A host still signing in"}
          </span>
        </div>
      )}
      <div className="mt-4">
        <GoingRow attendees={preview.attendees} total={preview.total} />
      </div>
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
      club: { select: { handle: true, name: true, imageUrl: true } },
      _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" } } } },
    },
  });
  if (!event) notFound();

  const isOwner = await canAccessEvent(event, user?.id ?? null);
  if (!isPublicPageVisible(event) && !isOwner) notFound();

  const [registration, preview, heads, open] = await Promise.all([
    registrationState(event.id, user?.id ?? null),
    attendeesPreview(event.id),
    attendingHeads(db, event.id),
    seatFree(db, event.id, event.guestCount, 1),
  ]);
  const alreadyGoing = registration === "going";
  const waitlistPlace =
    registration === "waitlisted" ? await waitlistPositionFor(event.id, user?.id ?? null) : null;

  const school = schoolFor(event.schoolDomain);
  const going = event._count.guests;
  // Spots are people in the room, plus-ones included, and a seat someone in
  // line fits is theirs — the same rule registration uses, so "Register"
  // never quietly lands on the waitlist.
  const spotsLeft = open ? Math.max(0, event.guestCount - heads) : 0;
  // With a waitlist, a full night still takes registrations.
  const over = event.status === "COMPLETED" || hasFinished(event);
  const started = hasStarted(event);
  const canRegister = event.published && !over && registration === "none";
  const registerMode = event.requiresApproval ? "request" : spotsLeft === 0 ? "waitlist" : "register";
  const ticketLabel =
    event.ticketType === "PAID" ? formatCents(event.ticketPriceCents) : "Free";
  // Calendar links only make sense once the night has a date.
  const h = await headers();
  const origin = siteOrigin(h);
  const calendar = event.date
    ? {
        ics: `/e/${event.id}/calendar.ics`,
        google: googleCalendarUrl({ ...event, date: event.date }, eventUrl(origin, event.id)),
      }
    : null;

  return (
    <main className="relative isolate flex-1 overflow-hidden">
      {/* The cover, blown up and blurred, tints the whole page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] scale-125 opacity-50 blur-3xl saturate-150 [mask-image:linear-gradient(to_bottom,black_30%,transparent)] dark:opacity-40"
      >
        <EventCover id={event.id} title="" coverUrl={event.coverUrl} sizes="100vw" />
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pt-6 pb-32 md:grid-cols-[minmax(0,330px)_minmax(0,1fr)] md:gap-12 md:px-8 md:pt-12 md:pb-16">
        <aside className="space-y-6">
          {/* A photo keeps its own shape; only the drawn cover is a square. */}
          <div
            className={
              event.coverUrl
                ? "overflow-hidden rounded-2xl bg-sunk shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]"
                : "aspect-square overflow-hidden rounded-2xl bg-sunk shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]"
            }
          >
            <EventCover id={event.id} title={event.title} coverUrl={event.coverUrl} sizes="(min-width: 768px) 330px, 100vw" natural />
          </div>
          <div className="hidden md:block">
            <HostedBy name={event.owner?.name ?? null} club={event.club} preview={preview} />
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
                <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[12px] font-medium text-brand">
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
              ) : over ? (
                <p className="text-[15px] text-ink-soft">This night has already happened.</p>
              ) : alreadyGoing ? (
                <div className="space-y-3">
                  <p className="font-medium text-forest">
                    You’re registered. See you there.
                  </p>
                  {calendar ? <AddToCalendar links={calendar} /> : null}
                </div>
              ) : registration === "pending" ? (
                <div>
                  <p className="font-medium text-amber">Request sent.</p>
                  <p className="mt-1 text-[15px] text-ink-soft">
                    The host confirms each guest — you’ll hear at {user?.email} once they do.
                  </p>
                </div>
              ) : registration === "waitlisted" ? (
                <div>
                  <p className="font-medium text-amber">
                    You’re {waitlistPlace ? `#${waitlistPlace}` : ""} on the waitlist.
                  </p>
                  <p className="mt-1 text-[15px] text-ink-soft">
                    {started
                      ? `If a spot opens the host can let you in — we’ll tell you at ${user?.email}.`
                      : `When a spot opens you’re in automatically — we’ll tell you at ${user?.email}.`}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-[15px] text-ink-soft">
                    {registerMode === "waitlist"
                      ? started
                        ? "This night is full. Join the waitlist and the host can let you in if a spot opens"
                        : "This night is full. Join the waitlist and you’re in automatically when a spot opens"
                      : registerMode === "request"
                        ? "The host approves each guest. Ask to join below"
                        : "Welcome! Register below to save your spot"}
                    {event.ticketType === "PAID"
                      ? ` — tickets are ${ticketLabel}, paid to the host`
                      : ""}
                    .
                  </p>
                  <RegisterForm
                    eventId={event.id}
                    viewer={user ? { name: user.name, email: user.email } : null}
                    calendar={calendar}
                    mode={registerMode}
                    started={started}
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
            <HostedBy name={event.owner?.name ?? null} club={event.club} preview={preview} />
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
              className="inline-flex min-h-11 items-center rounded-full bg-clay px-6 text-sm font-medium text-on-clay"
            >
              {registerMode === "request" ? "Request" : registerMode === "waitlist" ? "Waitlist" : "Register"}
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
