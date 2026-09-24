import { EmailSendError } from "@/lib/email/failure";
import { plainHeaders, stripHeader } from "@/lib/email/headers";

/**
 * Resend's HTTP API, one message per recipient so nobody sees anyone
 * else's address.
 *
 * `RESEND_API_KEY` and `RESEND_FROM` turn it on. `RESEND_FROM` is the
 * transactional From (mail.tryhosty.app, once that domain is verified).
 * Blasts use `RESEND_FROM_BLAST` (notify.tryhosty.app) when it is set, and
 * `RESEND_FROM` until then — see `fromAddressFor`.
 *
 * Resend authenticates a domain, so it cannot send anywhere but the
 * account owner's own inbox until one is verified. lib/email/smtp.ts is
 * the path that needs no domain, and lib/email/send.ts decides which one
 * runs. Live delivery is production only; this file does not check that.
 */

const SINGLE_URL = "https://api.resend.com/emails";
const BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Transactional mail and blasts leave from different domains so a
 * complaint on a blast cannot sink password resets. Both still read the
 * existing From until `notify.tryhosty.app` is verified.
 */
export type EmailStream = "transactional" | "blast";

export function fromAddressFor(stream: EmailStream): string | undefined {
  const transactional = process.env.RESEND_FROM || undefined;
  if (stream === "blast") return process.env.RESEND_FROM_BLAST || transactional;
  return transactional;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML part. Absent until a template renders one. */
  html?: string;
  replyTo?: string;
  /** Extra email headers (List-Unsubscribe, and similar). Not the HTTP Idempotency-Key. */
  headers?: Record<string, string>;
  /**
   * Resend dedupes a retry that sends the same key. Posted as the
   * Idempotency-Key HTTP header, one message at a time, because the key
   * belongs to one recipient.
   */
  idempotencyKey?: string;
  /** Which From domain. Defaults to transactional. */
  stream?: EmailStream;
  /** Stable name for logs. The body is never logged. */
  template?: string;
};

function payloadFor(email: OutgoingEmail): Record<string, unknown> {
  const from = stripHeader(fromAddressFor(email.stream ?? "transactional") ?? "");
  const headers = plainHeaders(email.headers);
  return {
    from,
    // One address. Never split, never a second recipient.
    to: [stripHeader(email.to)],
    subject: stripHeader(email.subject),
    text: email.text,
    ...(email.html !== undefined ? { html: email.html } : {}),
    ...(email.replyTo ? { reply_to: stripHeader(email.replyTo) } : {}),
    ...(headers ? { headers } : {}),
  };
}

async function post(url: string, body: unknown, idempotencyKey?: string): Promise<void> {
  const key = idempotencyKey ? stripHeader(idempotencyKey).trim() : "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new EmailSendError(res.status, detail);
  }
}

export async function sendViaResend(emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  let sent = 0;
  let batch: OutgoingEmail[] = [];

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const chunk = batch.slice(i, i + BATCH_SIZE);
      await post(BATCH_URL, chunk.map(payloadFor));
      sent += chunk.length;
    }
    batch = [];
  }

  for (const email of emails) {
    if (email.idempotencyKey) {
      await flushBatch();
      await post(SINGLE_URL, payloadFor(email), email.idempotencyKey);
      sent += 1;
      continue;
    }
    batch.push(email);
    if (batch.length >= BATCH_SIZE) await flushBatch();
  }
  await flushBatch();
  return sent;
}
