import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/account";
import { getCurrentUser } from "@/lib/session";

/**
 * The link in the confirmation email. Marks the address confirmed, then
 * sends a new account to sign in (someone already signed in — an older
 * account confirming from the profile — goes back there). A bad or used
 * link lands on /check-email, which can send a fresh one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const ok = token ? await verifyEmail(token) : null;
  if (!ok) return NextResponse.redirect(new URL("/check-email?expired=1", url.origin), 302);
  const signedIn = await getCurrentUser();
  const dest = signedIn ? "/profile?verified=1" : `/signin?verified=1&email=${encodeURIComponent(ok.email)}`;
  return NextResponse.redirect(new URL(dest, url.origin), 302);
}
