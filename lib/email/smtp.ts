import nodemailer, { type Transporter } from "nodemailer";
import { EmailSendError } from "@/lib/email/failure";

/**
 * SMTP, for the case Resend cannot cover: sending without owning a domain.
 *
 * Resend authenticates a *domain*, and refuses every recipient except the
 * account owner until one is verified. A project deployed on a vercel.app
 * subdomain has no domain to verify, so sign-up works for the owner and
 * nobody else. SMTP authenticates a *mailbox* instead — a Gmail address with
 * an app password, a Zoho or Fastmail account, or the SMTP endpoint of any
 * provider — which needs no DNS and delivers to anyone.
 *
 * SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM turn it on. SMTP_PORT
 * defaults to 587 (STARTTLS); set 465 for implicit TLS.
 */

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM,
  );
}

export function smtpPort(): number {
  const raw = Number(process.env.SMTP_PORT);
  return Number.isFinite(raw) && raw > 0 ? raw : 587;
}

let cached: Transporter | null = null;

/** One pooled transport per instance; reconnecting per message is slow. */
function transport(): Transporter {
  if (cached) return cached;
  const port = smtpPort();
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    // 465 is TLS from the first byte; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    pool: true,
    maxConnections: 3,
  });
  return cached;
}

/** Only for tests, which swap the environment between cases. */
export function resetSmtpTransport(): void {
  cached = null;
}

export type SmtpMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/**
 * One message per recipient, matching the Resend path: nobody is ever put in
 * a header alongside someone else's address.
 */
export async function sendViaSmtp(emails: SmtpMessage[]): Promise<number> {
  if (emails.length === 0) return 0;
  const from = process.env.SMTP_FROM!;
  let sent = 0;
  for (const email of emails) {
    try {
      await transport().sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      });
      sent += 1;
    } catch (error) {
      throw asSendError(error);
    }
  }
  return sent;
}

/**
 * Nodemailer reports SMTP replies as `responseCode`. 5xx splits the same way
 * the Resend path does: 535 and 530 are this server's credentials, 550 and
 * 553 are the address we were given.
 */
export function asSendError(error: unknown): EmailSendError {
  const reply = error as { responseCode?: number; response?: string; message?: string };
  const status = typeof reply?.responseCode === "number" ? reply.responseCode : 0;
  const detail = reply?.response ?? reply?.message ?? String(error);
  return new EmailSendError(status, detail, "smtp");
}
