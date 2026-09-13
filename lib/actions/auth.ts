"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { safeNextPath } from "@/lib/listing";
import { schoolDomainFor } from "@/lib/schools";
import { AccountError, NOT_DELIVERABLE_MESSAGE, sendVerification, siteOrigin, unverifiedMessage, verificationDeliverable } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

export type AuthFormState =
  | {
      error?: string;
      /** Sign-in refused because the address isn’t confirmed: offer a resend. */
      unverifiedEmail?: string;
      /** Sign-up done; the account waits for its link. `devLink` only without an email service, outside production. */
      pending?: { email: string; devLink?: string };
    }
  | undefined;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
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

  const { name, email, password } = parsed.data;
  const h = await headers();
  try {
    await assertRateLimit(`signup:ip:${clientIp(h)}`, ...LIMITS.signUp.perIp);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "That email is already registered. Try signing in." };
  }
  if (!verificationDeliverable()) return { error: NOT_DELIVERABLE_MESSAGE };

  // A .edu address makes this a student account; the domain picks the school.
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      schoolDomain: schoolDomainFor(email),
    },
  });
  // The account exists but can’t sign in until the link in the email is
  // opened. The form shows "check your inbox" with a resend.
  try {
    const { devLink } = await sendVerification(user, siteOrigin(h));
    return { pending: { email, devLink } };
  } catch (error) {
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
    if (error instanceof AuthError) {
      return { error: "That email and password don't match." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
