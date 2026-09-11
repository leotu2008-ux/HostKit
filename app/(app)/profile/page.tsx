import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { currentProfile } from "@/lib/session";
import { ProfileForm } from "@/components/profile-form";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "You" };

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

const LINKS = [
  { href: "/events", label: "My events", hint: "Upcoming and past nights you host" },
  { href: "/events/new", label: "Create event", hint: "Name, time, place, tickets" },
  { href: "/", label: "Discover", hint: "What's on near you" },
];

/** Mirrors the iOS app's You tab. */
export default async function ProfilePage() {
  const user = await currentProfile();

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">
        You
      </h1>

      {user ? (
        <>
          <Card className="mt-6 p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-clay to-amber text-lg font-semibold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[15px] text-ink-soft">{user.email}</p>
                {user.school ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="clay">{user.school.name}</Badge>
                    {user.classYear ? <Badge>Class of {user.classYear}</Badge> : null}
                  </div>
                ) : null}
              </div>
            </div>
            {user.bio ? (
              <p className="mt-4 text-[15px] text-ink-soft">{user.bio}</p>
            ) : null}
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="mb-4 font-display text-lg text-ink">Edit profile</h2>
            <ProfileForm
              name={user.name}
              classYear={user.classYear}
              bio={user.bio}
              isStudent={Boolean(user.school)}
            />
            <p className="mt-3 text-[13px] text-ink-mute">
              {user.school
                ? `Your school comes from your ${user.schoolDomain} email.`
                : "Sign up with a school .edu email to see campus events first."}
            </p>
          </Card>

          <Card className="mt-4 divide-y divide-line overflow-hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-sunk"
              >
                <span>
                  <span className="block font-medium text-ink">{link.label}</span>
                  <span className="block text-[13px] text-ink-mute">{link.hint}</span>
                </span>
                <span aria-hidden className="text-ink-mute">
                  ›
                </span>
              </Link>
            ))}
          </Card>

          <form action={signOutAction} className="mt-6">
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <Card className="mt-6 p-6 text-center">
          <p className="text-lg font-semibold text-ink">Host your own nights</p>
          <p className="mx-auto mt-1 max-w-sm text-[15px] text-ink-soft">
            Sign in to see the events you host, check guests in, and publish
            new ones — here or in the iOS app. Students: use your school .edu
            email to see what’s on at your campus first.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/signin" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" variant="secondary" size="lg">
              Create an account
            </ButtonLink>
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-[13px] text-ink-mute">
        Light and dark follow your device’s appearance setting.
      </p>
    </div>
  );
}
