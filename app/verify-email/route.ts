import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/account";

/** The link in the verification email. Marks the address confirmed, then lands on the profile. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const ok = token ? await verifyEmail(token) : null;
  return NextResponse.redirect(new URL(ok ? "/profile?verified=1" : "/profile?verified=0", url.origin), 302);
}
