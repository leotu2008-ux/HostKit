import Link from "next/link";
import { TabBar } from "@/components/tab-bar";
import { getCurrentUser } from "@/lib/session";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="app-frame flex min-h-dvh w-full max-w-[430px] flex-col bg-paper">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/" className="font-display text-[19px] text-ink">
            Host<span className="text-clay">Kit</span>
          </Link>
          {user ? (
            <span className="max-w-[40%] truncate text-[13px] text-ink-mute">
              {user.name}
            </span>
          ) : (
            <Link
              href="/signin"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-clay"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
