import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; publish?: string }>;
}) {
  if (await getCurrentUser()) redirect("/events/claim");
  const query = await searchParams;
  const next = query.next;
  const publish = query.publish === "1";

  return (
    <>
      <h1 className="font-display text-2xl text-ink">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        {publish
          ? "Sign in to publish this night."
          : "Pick up where you left off."}
      </p>
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        next={next}
        publish={publish}
      />
      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link
          href={
            next
              ? `/signup?next=${encodeURIComponent(next)}${publish ? "&publish=1" : ""}`
              : "/signup"
          }
          className="font-medium text-clay hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
