import { signOutAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";
import { Button, ButtonLink } from "@/components/ui";

export const metadata = { title: "You" };

export default async function ProfilePage() {
  const user = await getCurrentUser();

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
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <p className="text-[12px] font-medium tracking-[0.06em] text-clay uppercase">
        Profile
      </p>
      <h1 className="font-display mt-1 text-[28px] text-ink">{user.name}</h1>
      <p className="mt-1 text-[15px] text-ink-soft">{user.email}</p>

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
      </ul>

      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
