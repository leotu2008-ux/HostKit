"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AccountError, requestPasswordReset, resetPassword, sendVerification, siteOrigin } from "@/lib/account";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";

export type AccountFormState = { error?: string; sent?: boolean; devLink?: string } | undefined;

/** /forgot-password: always "sent", never says whether the address exists. */
export async function forgotPasswordAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter your email address." };
  const h = await headers();
  try {
    await assertRateLimit(`forgot:ip:${clientIp(h)}`, ...LIMITS.forgot.perIp);
    await assertRateLimit(`forgot:email:${email}`, ...LIMITS.forgot.perEmail);
    const { devLink } = await requestPasswordReset(email, siteOrigin(h));
    return { sent: true, devLink };
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }
}

/** /reset-password?token=…: sets the new password, then sends you to sign in. */
export async function resetPasswordAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "Those passwords don't match." };
  try {
    await resetPassword(token, password);
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message };
    throw error;
  }
  redirect("/signin?reset=1");
}

/** Profile → "Resend the link". */
export async function resendVerificationAction(_prev: AccountFormState, _formData: FormData): Promise<AccountFormState> {
  const me = await requireUser("/profile");
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  try {
    await assertRateLimit(`verify:user:${user.id}`, ...LIMITS.verify.perUser);
    const { devLink } = await sendVerification(user, siteOrigin(await headers()));
    refresh();
    return { sent: true, devLink };
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }
}
