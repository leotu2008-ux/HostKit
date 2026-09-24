import nodemailer, { type Transporter } from "nodemailer";
import { EmailSendError } from "@/lib/email/failure";
import { plainHeaders, stripHeader } from "@/lib/email/headers";
import type { OutgoingEmail } from "@/lib/email/resend";

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

/**
 * True for a host that cannot leave this machine. Preview must not be able
 * to satisfy this with the production Gmail host.
 */
export function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  let name = host.trim().toLowerCase();
  if (name.startsWith("[") && name.endsWith("]")) name = name.slice(1, -1);
  if (name === "localhost" || name === "::1") return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return false;
  const parts = name.split(".").map(Number);
  return parts[0] === 127 && parts.every((n) => n <= 255);
}

/**
 * Anywhere but production, only loopback is dialed. Production with a
 * configured mailbox may use Gmail. This is the belt on the SMTP function
 * itself, so a direct call cannot reach Gmail from Preview.
 */
function assertSmtpHostAllowed(): void {
  if (isLoopbackHost(process.env.SMTP_HOST)) return;
  if (process.env.VERCEL_ENV === "production" && isSmtpConfigured()) return;
  throw new EmailSendError(0, "Refusing SMTP to a non-loopback host while live delivery is off.", "smtp");
}

/** RFC 5321's limit on a forward path; no deliverable address is longer. */
const MAX_ADDRESS_LENGTH = 254;

/**
 * Nodemailer's address parser is quadratic in its input (GHSA-2x7j-588g-ccc2),
 * so an address no server would accept is refused before it gets parsed. 553
 * is the reply a server gives for a mailbox name it won't take, so this fails
 * exactly as that address would have.
 */
function assertAddressLength(address: string | undefined): void {
  if (address === undefined || address.length <= MAX_ADDRESS_LENGTH) return;
  throw new EmailSendError(553, `Address is ${address.length} characters; the limit is ${MAX_ADDRESS_LENGTH}.`, "smtp");
}

/**
 * One message per recipient, matching the Resend path: nobody is ever put in
 * a header alongside someone else's address.
 */
export async function sendViaSmtp(emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  assertSmtpHostAllowed();
  const from = stripHeader(process.env.SMTP_FROM!);
  let sent = 0;
  for (const email of emails) {
    assertAddressLength(email.to);
    assertAddressLength(email.replyTo);
    const headers = plainHeaders(email.headers);
    try {
      await transport().sendMail({
        from,
        to: stripHeader(email.to),
        subject: stripHeader(email.subject),
        text: email.text,
        ...(email.html !== undefined ? { html: email.html } : {}),
        ...(email.replyTo ? { replyTo: stripHeader(email.replyTo) } : {}),
        ...(headers ? { headers } : {}),
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
