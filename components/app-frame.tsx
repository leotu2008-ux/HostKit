import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { AppChrome } from "@/components/app-chrome";
import { Avatar } from "@/components/avatar";
import { CreateEventButton } from "@/components/create-event-button";
import { InstallPrompt } from "@/components/install-prompt";
import { ButtonLink } from "@/components/ui";
import { DesktopNav, TabBar } from "@/components/tab-bar";
import { hasDashboardAccess } from "@/lib/access";
import { signOutAction } from "@/lib/actions/auth";
import { currentProfile } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { washCss, washPaletteFor } from "@/lib/school-wash";

/**
 * The app shell. Phones get a compact header and the bottom tab bar; wider
 * screens get the same destinations and a Create button in the top bar, so
 * the desktop site is a real layout rather than a phone column.
 *
 * The top bar floats: a rounded pill that hugs its contents, centred under
 * the top edge with a soft shadow, and the page showing through around it —
 * rather than a full-width band with a rule under it, which read as a
 * separate frame sitting on top of the site. It stays at the top of the
 * page and scrolls away with it; it does not stick to the viewport. The
 * logo and the avatar both open the account menu.
 *
 * Both of those — the floating bar and the tab bar — are wrapped in
 * <AppChrome>, which drops them inside an event workspace: an app doesn't
 * carry the marketing nav inside the product, and the workspace has its own
 * sidebar and app bar for the same job. The install prompt and the school
 * wash are the whole-account furniture and stay everywhere.
 */
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await currentProfile();
  const canCreate = Boolean(user && hasDashboardAccess(user));
  const unread = user ? await unreadCount(user.id) : 0;
  const menuUser = user
    ? { name: user.name, email: user.email, imageUrl: user.imageUrl, school: user.school, classYear: user.classYear }
    : null;

  // The page wash follows the student's school. Signed out, or at a school
  // whose colour we don't hold, the token in globals.css stands as it is.
  const wash = user?.school?.color ? washPaletteFor(user.school.color) : null;

  return (
    <div className="flex min-h-dvh w-full flex-col">
      {wash ? (
        <style
          // Built from a hex in lib/schools.ts, never from anything a user typed.
          dangerouslySetInnerHTML={{ __html: washCss(wash) }}
        />
      ) : null}
      <AppChrome>
        <header className="no-print pointer-events-none relative z-40 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:pt-3">
          <div className="pointer-events-auto mx-auto flex h-14 w-fit max-w-full items-center gap-6 rounded-full bg-surface/95 pr-2 pl-3 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_24px_rgb(0_0_0/0.09),0_0_0_1px_rgb(0_0_0/0.04)] backdrop-blur-xl md:pl-4">
            <AccountMenu user={menuUser} signOut={signOutAction} align="left" label="Account menu">
              <span className="flex items-center gap-2 font-event text-[21px] text-ink">
                <Image
                  src="/logo.png"
                  alt=""
                  width={28}
                  height={28}
                  priority
                  className="h-7 w-7 rounded-[8px] ring-1 ring-line"
                />
                <span>
                  Host<span className="text-brand">y</span>
                </span>
              </span>
            </AccountMenu>
            <DesktopNav />
            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              {canCreate ? (
                <CreateEventButton className="hidden h-9 items-center rounded-full px-4 text-sm font-medium md:inline-flex" />
              ) : (
                <ButtonLink href="/signup" variant="brand" size="sm" className="hidden h-9 px-4 md:inline-flex">
                  Join the waitlist
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
                <AccountMenu user={menuUser} signOut={signOutAction} align="right" label={`${user.name} — account menu`}>
                  <Avatar name={user.name} imageUrl={user.imageUrl} size={36} />
                </AccountMenu>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
      </AppChrome>
      {/* The phone-only bottom padding stays unconditional: it is the
          clearance for the fixed TabBar, and it is already a harmless no-op
          on the routes that hide the bar (/e/, /rsvp/). md and up — where
          the workspace is designed to be used — it is zero. */}
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <InstallPrompt />
      <AppChrome>
        <TabBar />
      </AppChrome>
    </div>
  );
}
