import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { EmailSendError, canDeliverLive, canDeliverToCatcher, sendEmails } from "@/lib/email/send";
import { schoolDomainFor } from "@/lib/schools";

/**
 * Account plumbing that goes through email: password resets and address
 * verification. Both work with one-time links whose token is only ever
 * stored hashed. The link is never written to the log. It is returned as
 * `devLink` only when `VERCEL_ENV` is unset — a laptop. Preview and
 * production do not get it, even when no mail actually left.
 */

export class AccountError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const RESET_TTL_MS = 60 * 60_000;
export const VERIFY_TTL_MS = 24 * 60 * 60_000;
/** An approval invite is a set-password link; a week to act on it. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

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
 * True when a confirmation link can reach someone, or this is a laptop
 * (`VERCEL_ENV` unset) where the link is handed back instead. Preview sets
 * `VERCEL_ENV` and `NODE_ENV=production`, so it is not a laptop and it is
 * not live delivery. Sign-up refuses otherwise — an account nobody can
 * confirm is worse than no account.
 */
export function verificationDeliverable(): boolean {
  return !process.env.VERCEL_ENV || canDeliverLive();
}

export const NOT_DELIVERABLE_MESSAGE =
  "Email isn’t set up on this server yet, so new accounts can’t be confirmed. Ask whoever runs it to add Resend (RESEND_API_KEY and RESEND_FROM) or SMTP (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM).";

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

/**
 * What sign-up says when the send failed on this server's side — a sending
 * domain that was never verified, or a bad API key. Telling someone to check
 * an address that is perfectly fine sends them hunting for a typo that does
 * not exist, so this says plainly that it is not them.
 */
export function sendBlockedMessage(email: string): string {
  return `We couldn’t send the confirmation email to ${email}, and it isn’t your address — this server’s email isn’t finished being set up, so the account wasn’t created. Ask whoever runs it to finish Resend (a verified sending domain and RESEND_FROM) or SMTP (the mailbox login and SMTP_FROM).`;
}

/** Picks the message that matches why the provider refused. */
export function messageForSendFailure(email: string, error: unknown): string {
  if (error instanceof EmailSendError) {
    return error.cause === "recipient" ? sendFailedMessage(email) : sendBlockedMessage(email);
  }
  // No response at all (a timeout, DNS, a 500 at the provider) is not
  // something the person signing up can act on either.
  return sendBlockedMessage(email);
}

async function deliver(
  to: string,
  subject: string,
  text: string,
  link: string,
  template: string,
  required = false,
): Promise<{ devLink?: string }> {
  const handingOff = canDeliverLive() || canDeliverToCatcher();
  // Preview and production without a real delivery path must not keep an
  // account that can never open its link. A laptop still gets `devLink`.
  if (!handingOff && required && process.env.VERCEL_ENV) {
    throw new AccountError(NOT_DELIVERABLE_MESSAGE, 503);
  }
  await sendEmails([{ to, subject, text, template }]);
  return !handingOff && !process.env.VERCEL_ENV ? { devLink: link } : {};
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
      "Reset your Hosty password",
      [
        `Hi ${user.name.split(" ")[0]},`,
        "",
        "Someone asked to reset the password on this Hosty account. If that was you, open this link within the hour:",
        link,
        "",
        "If it wasn't you, ignore this — your password hasn't changed.",
      ].join("\n"),
      link,
      "password_reset",
    ),
  );
}

/**
 * The administrator let this person in. Their account exists with an unusable
 * password; this link sets the real one. It rides the reset-token machinery,
 * so /reset-password handles it and an expired invite is fixed by "Forgot
 * password" like any other account.
 */
export async function sendApprovalInvite(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<{ devLink?: string }> {
  const token = await issue(user.id, "reset", INVITE_TTL_MS);
  const link = `${origin}/reset-password?token=${token}`;
  return deliver(
    user.email,
    "You're in — set your Hosty password",
    [
      `Hi ${user.name.split(" ")[0] || "there"},`,
      "",
      "You're off the Hosty waitlist. Set a password to start planning:",
      link,
      "",
      "The link works for a week. After that, use \"Forgot password\" on the sign-in page.",
    ].join("\n"),
    link,
    "approval_invite",
    true,
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
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      sessionVersion: { increment: 1 },
      // Opening a link sent to the inbox proves the inbox.
      emailVerifiedAt: new Date(),
    },
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
    "Confirm your email for Hosty",
    [
      `Hi ${user.name.split(" ")[0]},`,
      "",
      "Tap this link to confirm this is your address and finish creating your account (it works for 24 hours):",
      link,
      "",
      "Until you do, you can’t sign in. If you didn’t sign up for Hosty, ignore this.",
    ].join("\n"),
    link,
    "verify_email",
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
    throw new AccountError(messageForSendFailure(email, error), 502);
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
