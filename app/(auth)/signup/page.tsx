import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signUpAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/listing";

export const metadata = { title: "Join the waitlist" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; publish?: string }>;
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
      <h1 className="font-display text-2xl text-ink">Join the waitlist</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Leave your name and email. We’ll keep you posted whenever updates happen.
      </p>
      <AuthForm action={signUpAction} submitLabel="Join the waitlist" includeName includePassword={false} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link
          href={
            next
              ? `/signin?next=${encodeURIComponent(next)}${publish ? "&publish=1" : ""}`
              : "/signin"
          }
          className="font-medium text-clay hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
