import { stripHeader } from "@/lib/email/headers";
import { isResendConfigured, sendViaResend, type OutgoingEmail } from "@/lib/email/resend";
import { isLoopbackHost, isSmtpConfigured, sendViaSmtp } from "@/lib/email/smtp";

/**
 * The one place Hosty sends email from, and the one place that decides how.
 *
 * Two transports, because they authenticate different things:
 *
 * - Resend authenticates a **domain**. Until one is verified it delivers only
 *   to the account owner's own address, so sign-up works for the owner and
 *   fails for everyone else. A deployment on a `vercel.app` subdomain has no
 *   domain it can verify.
 * - SMTP authenticates a **mailbox** — a Gmail app password, Zoho, Fastmail,
 *   or any provider's SMTP endpoint. No DNS, and it delivers to anyone.
 *   Production Gmail is temporary: one mailbox shared by sign-in mail and
 *   blasts. `fromAddressFor` is the split that replaces it (`mail.` vs
 *   `notify.`) once those domains verify.
 *
 * Resend wins when both are set: it is the better path once a domain exists,
 * and leaving SMTP configured underneath means one environment variable
 * switches back if the domain lapses.
 *
 * Neither path runs unless live delivery is on. `NODE_ENV` cannot say that:
 * Vercel preview sets it to `production`. `VERCEL_ENV === "production"` can.
 * Everywhere else we log the template name and the recipient — never the
 * body, which is where a magic link lives — and return a success-shaped
 * count so the caller does not crash. A loopback SMTP host is the one
 * exception, so a local catcher (Mailpit) still receives mail.
 */

export type { OutgoingEmail };
export { EmailSendError, classifyEmailFailure } from "@/lib/email/failure";
export type { EmailFailure, EmailTransport } from "@/lib/email/failure";
export { fromAddressFor, type EmailStream } from "@/lib/email/resend";

/** True when email can actually leave the building, by either route. */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

/**
 * True only on a Vercel production deployment that has a transport.
 * Preview and a laptop are never live, even when the keys are present.
 */
export function canDeliverLive(): boolean {
  return process.env.VERCEL_ENV === "production" && isEmailConfigured();
}

/**
 * A local catcher. SMTP to loopback is allowed while live delivery is off.
 * Preview cannot use it to reach Gmail: that host is not loopback.
 */
export function canDeliverToCatcher(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return isSmtpConfigured() && isLoopbackHost(process.env.SMTP_HOST);
}

/** Which transport is configured. Live delivery is a separate question. */
export function activeTransport(): "resend" | "smtp" | null {
  if (isResendConfigured()) return "resend";
  if (isSmtpConfigured()) return "smtp";
  return null;
}

function loggedName(email: OutgoingEmail): string {
  return stripHeader(email.template?.trim() || email.subject || "message");
}

export async function sendEmails(emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  if (canDeliverLive()) {
    if (isResendConfigured()) return sendViaResend(emails);
    return sendViaSmtp(emails);
  }
  if (canDeliverToCatcher()) return sendViaSmtp(emails);
  for (const email of emails) {
    // Template name and recipient only. `text` and `html` hold the link.
    console.log(`[email] not delivered — ${loggedName(email)} to ${stripHeader(email.to)}`);
  }
  return emails.length;
}
