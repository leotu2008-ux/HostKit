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
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
    }
    sent += chunk.length;
  }
  return sent;
}
