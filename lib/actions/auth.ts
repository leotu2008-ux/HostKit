"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { safeNextPath } from "@/lib/listing";
import { schoolDomainFor } from "@/lib/schools";
import { sendVerificationQuietly, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

export type AuthFormState = { error?: string } | undefined;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
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

  // A .edu address makes this a student account; the domain picks the school.
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      schoolDomain: schoolDomainFor(email),
    },
  });
  await sendVerificationQuietly(user, siteOrigin(h));

  return attemptSignIn(email, password, formData);
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
    if (error instanceof AuthError) {
      return { error: "That email and password don't match." };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
