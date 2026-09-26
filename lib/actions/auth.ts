"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { safeNextPath } from "@/lib/listing";
import { AccountError, unverifiedMessage } from "@/lib/account";
import { joinEmailList } from "@/lib/email-list";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";
import { WAITLIST_COUNT_TAG, readWaitlistCount } from "@/lib/waitlist-count";

export type AuthFormState =
  | {
      error?: string;
      /** Sign-in refused because the address isn’t confirmed: offer a resend. */
      unverifiedEmail?: string;
      /** Sign-up adds the address to the list. It does not create an account. */
      listed?: {
        email: string;
        /** Everyone on the list, read just after they joined; null if unread. */
        waitlistCount?: number | null;
      };
    }
  | undefined;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const h = await headers();
  // No account is created. The dashboard stays limited to Maya Chen;
  // everyone else is recorded on the email list and emailed a confirmation.
  try {
    await assertRateLimit(`signup:ip:${clientIp(h)}`, ...LIMITS.signUp.perIp);
    const { email } = await joinEmailList(parsed.data);
    // The landing page's cached count is out of date now: expire it so the
    // next view reads the new number, and hand this tab the fresh one.
    updateTag(WAITLIST_COUNT_TAG);
    return { listed: { email, waitlistCount: await readWaitlistCount() } };
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    if (error instanceof AccountError) return { error: error.message };
    throw error;
  }
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  const h = await headers();
  try {
    await assertRateLimit(`signin:ip:${clientIp(h)}`, ...LIMITS.signIn.perIp);
    await assertRateLimit(`signin:email:${email}`, ...LIMITS.signIn.perEmail);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }
  return attemptSignIn(email, password, formData);
}

function claimRedirect(formData?: FormData) {
  const next = safeNextPath(formData?.get("next"), "/events");
  const publish = String(formData?.get("publish") ?? "") === "1";
  const params = new URLSearchParams({ next });
  if (publish) params.set("publish", "1");
  return `/events/claim?${params.toString()}`;
}

async function attemptSignIn(
  email: string,
  password: string,
  formData?: FormData,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: claimRedirect(formData),
    });
    return undefined;
  } catch (error) {
    // Auth.js signals a successful sign-in by throwing a redirect. Only a real
    // AuthError means the credentials were wrong.
    if (error instanceof CredentialsSignin && error.code === "unverified") {
      return { error: unverifiedMessage(email), unverifiedEmail: email };
    }
    if (error instanceof CredentialsSignin && error.code === "closed") {
      return {
        error: "Join the waitlist.",
      };
    }
    if (error instanceof AuthError) {
      return { error: "That email and password don't match." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
