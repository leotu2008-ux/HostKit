import { signOutAction } from "@/lib/actions/auth";
import { setGuestListVisibilityAction } from "@/lib/actions/profile";
import { currentProfile } from "@/lib/session";
import { PhoneForm } from "@/components/phone-form";
import { Button, ButtonLink, Card } from "@/components/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await currentProfile();
  if (!user) redirect("/signin?next=%2Fsettings");

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Settings</h1>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-lg text-ink">Phone number</h2>
        <p className="mt-1 mb-4 text-[15px] text-ink-soft">
          Add your mobile so hosts can reach you about events you’re going to. Verified with a text.
        </p>
        <PhoneForm phone={user.phone} verified={Boolean(user.phone && user.phoneVerifiedAt)} />
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Who’s going</h2>
        <p className="mt-1 mb-4 text-[15px] text-ink-soft">
          Event pages show the first few people going — first name and photo. You can sit that out.
        </p>
        <form action={setGuestListVisibilityAction} className="flex items-center gap-3">
          <input type="hidden" name="showOnGuestLists" value={user.showOnGuestLists ? "off" : "on"} />
          <button
            type="submit"
            role="switch"
            aria-checked={user.showOnGuestLists}
            className={
              user.showOnGuestLists
                ? "relative h-6 w-11 shrink-0 rounded-full bg-clay transition-colors"
                : "relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors"
            }
          >
            <span
              aria-hidden
              className={
                user.showOnGuestLists
                  ? "absolute top-0.5 left-[22px] h-5 w-5 rounded-full bg-white"
                  : "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white"
              }
            />
          </button>
          <span className="text-sm font-medium text-ink">Show me on guest lists</span>
        </form>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Connect an agent</h2>
        <p className="mt-1 mb-4 text-[15px] text-ink-soft">
          Let Cursor or Claude read your events and guest lists. Read-only, and only this account.
        </p>
        <ButtonLink href="/mcp" variant="secondary">
          Set it up
        </ButtonLink>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Account</h2>
        <p className="mt-1 text-[15px] text-ink-soft">
          Signed in as <span className="font-medium text-ink">{user.email}</span>.
        </p>
        <p className="mt-1 text-[13px] text-ink-mute">
          Light and dark follow your device’s appearance setting, here and in the iOS app.
        </p>
        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}
