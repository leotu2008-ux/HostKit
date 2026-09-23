import Link from "next/link";
import { readyToPublish, type BriefFacts } from "@/lib/brief";
import { describeCountdown } from "@/lib/plan";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { publishEventAction } from "@/lib/actions/events";
import { signOutAction } from "@/lib/actions/auth";
import { currentProfile } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { AccountMenu } from "@/components/account-menu";
import { Avatar } from "@/components/avatar";
import { Badge, Button, ButtonLink } from "@/components/ui";
import type { EventVisibility } from "@/generated/prisma/enums";

/**
 * The workspace's app bar: where you are, how long you've got, whether
 * guests can see it, the one publish decision, and the account. It replaces
 * the cover header the event layout used to open with — a 20px title over an
 * 80px photo, which is a magazine's furniture, not a product's. The cover
 * itself moved to the Brief tab, where it is one of the facts about the
 * night rather than the frame around every page.
 *
 * The right cluster ends with the Inbox bell and the account menu because
 * AppChrome hides the marketing header in here, and those two are the only
 * route to the inbox and to signing out. They render at every width — a host
 * on a narrow screen must still be able to leave. When the row gets tight
 * below md it is "Event page ↗" that goes: it is the one control with
 * another way in (the sidebar's Overview, then the public link).
 *
 * A server component: it renders the publish form directly, exactly as the
 * layout did, so nothing about who may publish or what happens when they do
 * has changed. The unread count is read here, the same way AppFrame reads it.
 */
export async function WorkspaceBar({
  event,
  days,
  signedIn,
}: {
  /** The whole brief, because readyToPublish reads all of it. */
  event: BriefFacts & { id: string; published: boolean; visibility: EventVisibility };
  days: number | null;
  signedIn: boolean;
}) {
  const user = await currentProfile();
  const unread = user ? await unreadCount(user.id) : 0;
  const menuUser = user
    ? {
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        school: user.school,
        classYear: user.classYear,
      }
    : null;

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line">
      {/* The translucent blur is its own layer behind the row rather than a
          class on the header, because backdrop-filter makes an element the
          containing block for `fixed` descendants — and the account menu is
          a `fixed` bottom sheet on phones. Blurring the header directly
          anchored that sheet to this 56px strip instead of the viewport. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface/90 backdrop-blur" />
      <div className="flex h-full items-center gap-3 px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {/* Always visible, at every width: with the marketing chrome hidden
              inside the workspace this breadcrumb is the way back out. */}
          <Link href="/events" className="shrink-0 text-[13px] text-ink-mute hover:text-ink">
            My events
          </Link>
          <span aria-hidden className="shrink-0 text-[13px] text-ink-mute">
            /
          </span>
          <span className="truncate text-[14px] font-medium text-ink">{event.title}</span>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Badge tone={days !== null && days >= 0 && days <= 14 ? "amber" : "neutral"}>
            {describeCountdown(days)}
          </Badge>
          <Badge tone={event.published ? "forest" : "neutral"}>
            {event.published ? VISIBILITY_LABEL[event.visibility] : "Draft"}
          </Badge>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* The wrapper carries the breakpoint, not the button: ButtonLink's
              own base class sets `inline-flex`, and two display utilities on
              one element are decided by stylesheet order, not class order. */}
          <span className="hidden md:inline-flex md:gap-2">
            <ButtonLink href={`/e/${event.id}`} variant="secondary" size="sm">
              Event page ↗
            </ButtonLink>
            <ButtonLink href={`/events/${event.id}/run-again`} variant="secondary" size="sm">
              Run it again
            </ButtonLink>
          </span>
          {event.published ? null : !readyToPublish(event) ? (
            // A blank or half-brief event has nothing worth signing in to
            // publish yet — send the host to finish the brief first.
            <ButtonLink href={`/events/${event.id}/brief`} size="sm">
              Finish the brief
            </ButtonLink>
          ) : signedIn ? (
            <form action={publishEventAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <Button type="submit" size="sm">
                Publish
              </Button>
            </form>
          ) : (
            <ButtonLink
              href={`/signin?next=${encodeURIComponent(`/events/${event.id}`)}&publish=1`}
              size="sm"
            >
              Sign in to publish
            </ButtonLink>
          )}

          {user ? (
            <Link
              href="/inbox"
              aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              {unread > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}

          {user ? (
            <AccountMenu
              user={menuUser}
              signOut={signOutAction}
              align="right"
              label={`${user.name} — account menu`}
            >
              <Avatar name={user.name} imageUrl={user.imageUrl} size={28} />
            </AccountMenu>
          ) : (
            <Link href="/signin" className="shrink-0 text-[13px] font-medium text-ink-soft hover:text-ink">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
