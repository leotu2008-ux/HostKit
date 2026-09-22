import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/listing";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; publish?: string; reset?: string; verified?: string; email?: string }>;
}) {
  const query = await searchParams;
  if (await getCurrentUser()) {
    if (query.publish === "1") {
      const params = new URLSearchParams();
      if (query.next) params.set("next", query.next);
      params.set("publish", "1");
      redirect(`/events/claim?${params}`);
    }
    redirect(safeNextPath(query.next, "/events"));
  }
  const next = query.next;
  const publish = query.publish === "1";

  return (
    <>
      <h1 className="font-display text-2xl text-ink">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        {query.verified === "1"
          ? "Email confirmed — your account is ready. Sign in."
          : query.reset === "1"
          ? "Your password is set. Sign in with it."
          : publish
            ? "Sign in to publish this night."
            : "Pick up where you left off."}
      </p>
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        next={next}
        publish={publish}
        email={query.email}
      />
      <p className="mt-3 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link
          href={
            next
              ? `/signup?next=${encodeURIComponent(next)}${publish ? "&publish=1" : ""}`
              : "/signup"
          }
          className="font-medium text-clay hover:underline"
        >
          Join the list
        </Link>
      </p>
    </>
  );
}
