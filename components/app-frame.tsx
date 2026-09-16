import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { Avatar } from "@/components/avatar";
import { InstallPrompt } from "@/components/install-prompt";
import { DesktopNav, TabBar } from "@/components/tab-bar";
import { signOutAction } from "@/lib/actions/auth";
import { currentProfile } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { washCss, washPaletteFor } from "@/lib/school-wash";

/**
 * The app shell. Phones get a compact header and the bottom tab bar; wider
 * screens get a full-width top bar with the same destinations and a Create
 * button, so the desktop site is a real layout rather than a phone column.
 * The logo and the avatar both open the account menu.
 */
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await currentProfile();
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
      <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 md:px-8">
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
                Host<span className="text-brand">Kit</span>
              </span>
            </span>
          </AccountMenu>
          <DesktopNav />
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <Link
              href="/events/new"
              className="hidden h-9 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper hover:opacity-90 md:inline-flex"
            >
              Create event
            </Link>
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
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <InstallPrompt />
      <TabBar />
    </div>
  );
}
