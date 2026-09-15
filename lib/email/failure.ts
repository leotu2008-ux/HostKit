/**
 * Why a send failed, in the only terms that change what we tell someone.
 *
 * - `sender`  — this server's fault. Bad credentials, or a sending identity
 *   the provider won't accept: Resend refuses every recipient but the account
 *   owner until a domain is verified, and SMTP refuses a login it can't
 *   authenticate. The person signing up did nothing wrong and cannot fix it.
 * - `recipient` — the address itself was rejected, usually a typo.
 * - `unknown` — anything else: a timeout, a 500 at the provider, no response.
 */
export type EmailFailure = "sender" | "recipient" | "unknown";

export type EmailTransport = "resend" | "smtp";

export class EmailSendError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly transport: EmailTransport = "resend",
  ) {
    super(`${transport === "smtp" ? "SMTP" : "Resend"} ${status}: ${detail.slice(0, 200)}`);
    this.name = "EmailSendError";
  }

  get cause(): EmailFailure {
    return classifyEmailFailure(this.status, this.detail, this.transport);
  }
}

/**
 * Resend answers 403 both for an unverified sending domain and for the
 * "testing emails only" restriction that comes with it, and 422 for an
 * address it won't accept. 401 is a bad key. Matched on the body as well as
 * the status, because 403 alone doesn't say which side is at fault.
 *
 * SMTP speaks in reply codes instead: 535 and 530 are the login this server
 * presented, 550/551/553 are the address it was asked to deliver to.
 */
export function classifyEmailFailure(
  status: number,
  detail: string,
  transport: EmailTransport = "resend",
): EmailFailure {
  const body = detail.toLowerCase();

  if (transport === "smtp") {
    if (status === 535 || status === 530 || status === 534) return "sender";
    if (status === 550 || status === 551 || status === 553) return "recipient";
    if (body.includes("invalid login") || body.includes("authentication failed")) return "sender";
    if (body.includes("username and password not accepted")) return "sender";
    // No reply code at all is a connection that never got as far as a reply:
    // a blocked port, a bad host, TLS refused. All of them are this server.
    if (status === 0) return "sender";
    return "unknown";
  }

  if (status === 401 || status === 403) return "sender";
  if (body.includes("domain is not verified") || body.includes("testing emails")) return "sender";
  if (body.includes("verify a domain")) return "sender";
  if (status === 422 && (body.includes("`to`") || body.includes("recipient") || body.includes("invalid to"))) {
    return "recipient";
  }
  return "unknown";
}
