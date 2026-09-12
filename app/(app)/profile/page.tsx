import { cookies } from "next/headers";
import { signOutAction } from "@/lib/actions/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/clubs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, ButtonLink } from "@/components/ui";
import { parsePreference, THEME_COOKIE } from "@/lib/theme";

export const metadata = { title: "You" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const themePref = parsePreference((await cookies()).get(THEME_COOKIE)?.value);

  if (!user) {
    return (
      <div className="px-4 py-10">
        <h1 className="font-display text-[28px] text-ink">You</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Sign in to host nights, check guests in, and pick up a plan in
          progress.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/signin" size="lg" className="w-full">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary" size="lg" className="w-full">
            Create an account
          </ButtonLink>
        </div>
        <div className="mt-10">
          <ThemeToggle initial={themePref} />
        </div>
      </div>
    );
  }

  const memberships = await db.clubMember.findMany({
    where: { userId: user.id },
    include: { club: { select: { slug: true, name: true, city: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="px-4 py-6">
      <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
        Profile
      </p>
      <h1 className="font-display mt-1 text-[28px] text-ink">{user.name}</h1>
      <p className="mt-1 text-[15px] text-ink-soft">{user.email}</p>

      <div className="mt-8">
        <ThemeToggle initial={themePref} />
      </div>

      <ul className="mt-8 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        <li>
          <ButtonLink
            href="/events"
            variant="ghost"
            className="h-14 w-full justify-start rounded-none px-4"
          >
            My events
          </ButtonLink>
        </li>
        <li>
          <ButtonLink
            href="/events/new"
            variant="ghost"
            className="h-14 w-full justify-start rounded-none px-4"
          >
            Create a night
          </ButtonLink>
        </li>
        <li>
          <ButtonLink
            href="/clubs/new"
            variant="ghost"
            className="h-14 w-full justify-start rounded-none px-4"
          >
            Start a club
          </ButtonLink>
        </li>
      </ul>

      <section className="mt-8">
        <h2 className="font-display text-lg text-ink">Your clubs</h2>
        {memberships.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            You haven&rsquo;t joined any yet. Find one on a night&rsquo;s page,
            or start your own.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {memberships.map((m) => (
              <li key={m.clubId}>
                <Link
                  href={`/c/${m.club.slug}`}
                  className="flex h-14 items-center justify-between gap-3 px-4 active:bg-sunk"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {m.club.name}
                    </span>
                    {m.club.city ? (
                      <span className="block truncate text-sm text-ink-soft">
                        {m.club.city}
                      </span>
                    ) : null}
                  </span>
                  <Badge tone={m.role === "MEMBER" ? "neutral" : "clay"}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
