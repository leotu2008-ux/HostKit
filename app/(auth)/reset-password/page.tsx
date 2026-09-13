import Link from "next/link";
import { ResetPasswordForm } from "@/components/account-forms";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <>
        <h1 className="font-display text-2xl text-ink">That link is missing its key</h1>
        <p className="mt-1 mb-6 text-sm text-ink-soft">Open the link from the email, or ask for a new one.</p>
        <Link href="/forgot-password" className="font-medium text-clay hover:underline">
          Send a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-2xl text-ink">Set a new password</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">Then sign in with it — everywhere, including the app.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
