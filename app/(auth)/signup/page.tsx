import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signUpAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/events");

  return (
    <>
      <h1 className="font-display text-2xl text-ink">Start planning</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        One account covers every event you host.
      </p>
      <AuthForm action={signUpAction} submitLabel="Create account" includeName />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-clay hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
