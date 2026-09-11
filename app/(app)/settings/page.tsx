import { signOutAction } from "@/lib/actions/auth";
import { currentProfile } from "@/lib/session";
import { PhoneForm } from "@/components/phone-form";
import { Button, Card } from "@/components/ui";
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
