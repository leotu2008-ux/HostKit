"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "That email is already registered. Try signing in." };
  }

  await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });

  // signIn redirects on success by throwing NEXT_REDIRECT, which must escape.
  return attemptSignIn(email, password);
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
  return attemptSignIn(email, password);
}

async function attemptSignIn(
  email: string,
  password: string,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/events" });
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
