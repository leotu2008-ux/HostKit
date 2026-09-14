import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmails } from "@/lib/email/resend";
import { schoolDomainFor } from "@/lib/schools";

/**
 * Account plumbing that goes through email: password resets and address
 * verification. Both work with one-time links whose token is only ever
 * stored hashed. Without Resend configured the link is logged and, outside
 * production, handed back to the caller so the flow can be exercised.
 */

export class AccountError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const RESET_TTL_MS = 60 * 60_000;
export const VERIFY_TTL_MS = 24 * 60 * 60_000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// Links point at SITE_URL when set, else the request's own origin.
export { siteOrigin } from "@/lib/site";

async function issue(userId: string, kind: "reset" | "verify", ttlMs: number): Promise<string> {
  const token = newToken();
  await db.$transaction([
    // One live link per purpose; asking again invalidates the old one.
    db.accountToken.deleteMany({ where: { userId, kind } }),
    db.accountToken.create({
      data: { userId, kind, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ]);
  return token;
}

async function consume(token: string, kind: "reset" | "verify"): Promise<{ userId: string } | null> {
  const row = await db.accountToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  await db.accountToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { userId: row.userId };
}

/**
 * True when a confirmation link can actually reach someone: an email
 * service is configured, or this is development (where the link is handed
 * back instead). Sign-up refuses otherwise — an account nobody can confirm
 * is worse than no account.
 */
export function verificationDeliverable(): boolean {
  return isEmailConfigured() || process.env.NODE_ENV !== "production";
}

export const NOT_DELIVERABLE_MESSAGE =
  "Email isn’t set up on this server yet, so new accounts can’t be confirmed. Ask whoever runs it to add RESEND_API_KEY and RESEND_FROM.";

/** What sign-in says to an account that hasn’t confirmed its address. */
export function unverifiedMessage(email: string): string {
  return `Confirm your email first — we sent a link to ${email}. Open it, then sign in.`;
}

/**
 * What sign-up says when the provider accepted the request but refused this
 * recipient — an address it won't deliver to, a sending domain that isn't
 * verified yet. Names the address, because a typo is the common cause, and
 * says the account wasn't kept, because it wasn't.
 */
export function sendFailedMessage(email: string): string {
  return `We couldn’t send the confirmation email to ${email}, so the account wasn’t created. Check the address and try again.`;
}

async function deliver(
  to: string,
  subject: string,
  text: string,
  link: string,
  required = false,
): Promise<{ devLink?: string }> {
  if (isEmailConfigured()) {
    await sendEmails([{ to, subject, text }]);
    return {};
  }
  if (required && process.env.NODE_ENV === "production") throw new AccountError(NOT_DELIVERABLE_MESSAGE, 503);
  console.log(`[account] no email configured — ${subject} for ${to}: ${link}`);
  return process.env.NODE_ENV !== "production" ? { devLink: link } : {};
}

/**
 * Runs a send whose caller must answer the same way regardless — the
 * password-reset and resend-confirmation forms, which never say whether an
 * address has an account. A provider failure is the operator's problem, not
 * a signal to hand back, so it is logged and swallowed. Sign-up is the
 * exception: it needs the throw, to undo the account it just wrote.
 */
async function blindly(
  what: string,
  to: string,
  send: () => Promise<{ devLink?: string }>,
): Promise<{ devLink?: string }> {
  try {
    return await send();
  } catch (error) {
    console.error(`[account] ${what} email to ${to} failed`, error);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Always answers the same way whether or not the address exists, so the
 * form can't be used to check who has an account.
 */
export async function requestPasswordReset(rawEmail: string, origin: string): Promise<{ devLink?: string }> {
  const email = rawEmail.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return {};
  const token = await issue(user.id, "reset", RESET_TTL_MS);
  const link = `${origin}/reset-password?token=${token}`;
  // Blind on the way out too: a send that fails only for addresses we hold
  // would answer differently from one for an address we don't, which is the
  // enumeration this function exists to avoid. The operator gets the log.
  return blindly("password reset", email, () =>
    deliver(
      email,
      "Reset your Student Events password",
      [
        `Hi ${user.name.split(" ")[0]},`,
        "",
        "Someone asked to reset the password on this Student Events account. If that was you, open this link within the hour:",
        link,
        "",
        "If it wasn't you, ignore this — your password hasn't changed.",
      ].join("\n"),
      link,
    ),
  );
}

/** Returns the account's email, so sign-in can be prefilled. */
export async function resetPassword(token: string, newPassword: string): Promise<string> {
  if (newPassword.length < 8) throw new AccountError("Use at least 8 characters.", 400);
  if (newPassword.length > 128) throw new AccountError("Use at most 128 characters.", 400);
  const hit = await consume(token, "reset");
  if (!hit) throw new AccountError("That reset link has expired or was already used. Ask for a new one.", 400);
  // Every existing session and API token dies with the old password.
  const user = await db.user.update({
    where: { id: hit.userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), sessionVersion: { increment: 1 } },
    select: { email: true },
  });
  return user.email;
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

/** Sends (or re-sends) the confirmation link. No-op once verified. Sign-in
 *  is refused until the link is opened, so this has to get through. */
export async function sendVerification(
  user: { id: string; email: string; name: string; emailVerifiedAt: Date | null },
  origin: string,
): Promise<{ devLink?: string; already?: true }> {
  if (user.emailVerifiedAt) return { already: true };
  const token = await issue(user.id, "verify", VERIFY_TTL_MS);
  const link = `${origin}/verify-email?token=${token}`;
  return deliver(
    user.email,
    "Confirm your email for Student Events",
    [
      `Hi ${user.name.split(" ")[0]},`,
      "",
      "Tap this link to confirm this is your address and finish creating your account (it works for 24 hours):",
      link,
      "",
      "Until you do, you can’t sign in. If you didn’t sign up for Student Events, ignore this.",
    ].join("\n"),
    link,
    true,
  );
}

/**
 * Another link for someone who can’t sign in yet. Blind: the same answer
 * whether or not the address has an account, or is already confirmed.
 */
export async function resendVerificationTo(rawEmail: string, origin: string): Promise<{ devLink?: string }> {
  const email = rawEmail.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return {};
  return blindly("confirmation", email, async () => ({
    devLink: (await sendVerification(user, origin)).devLink,
  }));
}

/** Marks the address verified. Returns the account, or null for a bad link. */
export async function verifyEmail(token: string): Promise<{ id: string; email: string } | null> {
  const hit = await consume(token, "verify");
  if (!hit) return null;
  const user = await db.user.update({
    where: { id: hit.userId },
    data: { emailVerifiedAt: new Date() },
    select: { id: true, email: true },
  });
  return user;
}

/**
 * Sign-up, for both the website form and the API: create the account, then
 * send the link that lets it sign in.
 *
 * The two steps are one unit on purpose. An account whose confirmation
 * email never went out can't sign in and can't be created again — the
 * address is taken — so if the send fails the row is removed and the caller
 * gets a message it can show. Only the provider refusing this recipient
 * reaches that path; anything already validated (a duplicate address, an
 * unconfigured server) is rejected before the row is written.
 */
export async function createAccountPendingVerification(input: {
  name: string;
  email: string;
  password: string;
  origin: string;
}): Promise<{ email: string; devLink?: string }> {
  const email = input.email.trim().toLowerCase();

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AccountError("That email is already registered. Try signing in.", 409);
  }
  if (!verificationDeliverable()) throw new AccountError(NOT_DELIVERABLE_MESSAGE, 503);

  const user = await db.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await bcrypt.hash(input.password, 10),
      // A .edu address makes this a student account; the domain picks the school.
      schoolDomain: schoolDomainFor(email),
    },
  });

  try {
    const { devLink } = await sendVerification(user, input.origin);
    return { email: user.email, devLink };
  } catch (error) {
    // Leave nothing behind that the person can neither use nor re-register.
    await db.user.delete({ where: { id: user.id } }).catch((cleanup: unknown) => {
      console.error("[account] could not roll back a half-made account", cleanup);
    });
    if (error instanceof AccountError) throw error;
    console.error("[account] confirmation email failed", error);
    throw new AccountError(sendFailedMessage(email), 502);
  }
}

/** Best effort after sign-up: never fails the sign-up itself. */
export async function sendVerificationQuietly(
  user: { id: string; email: string; name: string; emailVerifiedAt: Date | null },
  origin: string,
): Promise<void> {
  try {
    await sendVerification(user, origin);
  } catch (error) {
    console.error("[account] verification email failed", error);
  }
}
