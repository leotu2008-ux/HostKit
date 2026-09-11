import Link from "next/link";
import { cookies } from "next/headers";
import { InstallPrompt } from "@/components/install-prompt";
import { TabBar } from "@/components/tab-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/session";
import { parsePreference, THEME_COOKIE } from "@/lib/theme";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const themePref = parsePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="app-frame flex min-h-dvh w-full max-w-[430px] flex-col bg-paper">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-12 items-center justify-between gap-2 px-4">
          <Link href="/" className="font-display text-[19px] text-ink">
            Host<span className="text-clay">Kit</span>
          </Link>
          <div className="flex min-w-0 items-center">
            <ThemeToggle compact initial={themePref} />
            {user ? (
              <span className="max-w-[9rem] truncate text-[13px] text-ink-mute">
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
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <InstallPrompt />
      <TabBar />
    </div>
  );
}
