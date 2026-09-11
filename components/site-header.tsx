import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";
import { Button, ButtonLink } from "@/components/ui";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href={user ? "/events" : "/"}
          className="font-display text-xl text-ink"
        >
          Host<span className="text-clay">Kit</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/events"
                className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:bg-sunk hover:text-ink sm:block"
              >
                My events
              </Link>
              <span className="hidden text-sm text-ink-mute md:block">
                {user.name}
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <ButtonLink href="/signin" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
