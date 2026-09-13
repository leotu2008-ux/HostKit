import Link from "next/link";
import { ResendVerificationForm } from "@/components/account-forms";

export const metadata = { title: "Check your inbox" };

/**
 * Where an unconfirmed account lands: after sign-up (the form shows this
 * inline), from a sign-in that was refused, or from a link that expired.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; expired?: string; next?: string; publish?: string }>;
}) {
  const query = await searchParams;
  const email = query.email?.trim().toLowerCase() || null;
  const expired = query.expired === "1";
  const signInHref = query.next
    ? `/signin?next=${encodeURIComponent(query.next)}${query.publish === "1" ? "&publish=1" : ""}`
    : "/signin";

  return (
    <>
      <h1 className="font-display text-2xl text-ink">{expired ? "That link has expired" : "Check your inbox"}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        {expired
          ? "Confirmation links work for a day and only once. Enter your email and we’ll send a fresh one."
          : email
            ? `We sent a confirmation link to ${email}. Open it to finish creating your account, then sign in.`
            : "Enter the email on your account and we’ll send the confirmation link again."}
      </p>
      <ResendVerificationForm email={email ?? undefined} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already confirmed?{" "}
        <Link href={signInHref} className="font-medium text-clay hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
