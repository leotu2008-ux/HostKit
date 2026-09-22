import { isResendConfigured, sendViaResend, type OutgoingEmail } from "@/lib/email/resend";
import { isSmtpConfigured, sendViaSmtp } from "@/lib/email/smtp";

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
 *
 * Resend wins when both are set: it is the better path once a domain exists,
 * and leaving SMTP configured underneath means one environment variable
 * switches back if the domain lapses.
 */

export type { OutgoingEmail };
export { EmailSendError, classifyEmailFailure } from "@/lib/email/failure";
export type { EmailFailure, EmailTransport } from "@/lib/email/failure";

/** True when email can actually leave the building, by either route. */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

/** Which transport a send would use right now, for logs and diagnostics. */
export function activeTransport(): "resend" | "smtp" | null {
  if (isResendConfigured()) return "resend";
  if (isSmtpConfigured()) return "smtp";
  return null;
}

export async function sendEmails(emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  if (isResendConfigured()) return sendViaResend(emails);
  if (isSmtpConfigured()) return sendViaSmtp(emails);
  // Callers check isEmailConfigured() first; this is the belt and braces.
  throw new Error("No email transport is configured.");
}
