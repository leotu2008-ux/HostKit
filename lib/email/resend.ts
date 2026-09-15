/**
 * The one place HostKit sends email from. Resend's batch endpoint, one
 * message per recipient so nobody sees anyone else's address.
 *
 * `RESEND_API_KEY` and `RESEND_FROM` (e.g. "HostKit <events@your.domain>",
 * a domain verified in Resend) turn it on. Without them
 * `isEmailConfigured()` is false and blasts fall back to copy-and-paste.
 */

const BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Why a send failed, in the only terms that change what we tell someone.
 *
 * - `sender`  — this server's fault. The API key is wrong, or the sending
 *   domain isn't verified, which is Resend's default state: until a domain
 *   is verified it delivers only to the account owner's own address. The
 *   person signing up did nothing wrong and cannot fix it.
 * - `recipient` — the address itself was rejected, usually a typo.
 * - `unknown` — anything else: a timeout, a 500 at Resend, no response.
 */
export type EmailFailure = "sender" | "recipient" | "unknown";

export class EmailSendError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Resend ${status}: ${detail.slice(0, 200)}`);
    this.name = "EmailSendError";
  }

  get cause(): EmailFailure {
    return classifyEmailFailure(this.status, this.detail);
  }
}

/**
 * Resend answers 403 both for an unverified sending domain and for the
 * "testing emails only" restriction that comes with it, and 422 for an
 * address it won't accept. 401 is a bad key. Matched on the body as well as
 * the status, because 403 alone doesn't say which side is at fault.
 */
export function classifyEmailFailure(status: number, detail: string): EmailFailure {
  const body = detail.toLowerCase();
  if (status === 401 || status === 403) return "sender";
  if (body.includes("domain is not verified") || body.includes("testing emails")) return "sender";
  if (body.includes("verify a domain")) return "sender";
  if (status === 422 && (body.includes("`to`") || body.includes("recipient") || body.includes("invalid to"))) {
    return "recipient";
  }
  return "unknown";
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendEmails(emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  const from = process.env.RESEND_FROM!;
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE).map((email) => ({
      from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }));
    const res = await fetch(BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new EmailSendError(res.status, detail);
    }
    sent += chunk.length;
  }
  return sent;
}
