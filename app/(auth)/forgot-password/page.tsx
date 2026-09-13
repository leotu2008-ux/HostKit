import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl text-ink">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Enter the email on your account and we’ll send a link to set a new one.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/signin" className="font-medium text-clay hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
