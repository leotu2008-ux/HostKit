import { signOutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/session";
import { Button, Card } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser("/settings");

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Settings</h1>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-lg text-ink">Appearance</h2>
        <p className="mt-1 text-[15px] text-ink-soft">
          Light and dark follow your device’s appearance setting, here and in the iOS app.
        </p>
      </Card>

      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
