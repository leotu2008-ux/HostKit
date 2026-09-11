import Image from "next/image";
import Link from "next/link";
import { DesktopNav, TabBar } from "@/components/tab-bar";
import { getCurrentUser } from "@/lib/session";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * The app shell. Phones get a compact header and the bottom tab bar; wider
 * screens get a full-width top bar with the same destinations and a Create
 * button, so the desktop site is a real layout rather than a phone column.
 */
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 font-event text-[21px] text-ink">
            <Image
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              priority
              className="h-7 w-7 rounded-[8px] ring-1 ring-line"
            />
            <span>
              Host<span className="text-clay">Kit</span>
            </span>
          </Link>
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
                href="/profile"
                aria-label={`${user.name} — profile`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-clay to-amber text-[12px] font-semibold text-white"
              >
                {initials(user.name)}
              </Link>
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
      <TabBar />
    </div>
  );
}
