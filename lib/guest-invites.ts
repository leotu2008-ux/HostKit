import { stripHeader } from "@/lib/email/headers";

/**
 * Who gets an RSVP email, and what that email says.
 *
 * Pure on purpose. The send lives in lib/guest-invite-send.ts, and the
 * button lives in a server action. Adding a name to the list does not come
 * through here.
 *
 * Nothing in this file reads a budget, a ticket price, or any cent amount.
 * The invitation is the night, the time, the host, and the link.
 */

export type InviteGuest = {
  id: string;
  name: string;
  email: string | null;
  rsvpToken: string;
};

export type InviteRecipient = {
  guest: InviteGuest;
  /** Trimmed and lowercased. One address is one email, even if two rows share it. */
  email: string;
};

export type InviteSelection = {
  recipients: InviteRecipient[];
  /** Guests with no address. A repeated address is not a skip — it is one send. */
  skippedNoEmail: number;
};

/**
 * Guests the host asked to email.
 *
 * Blank addresses are skipped. The same address twice (any case, any
 * surrounding space) is one recipient: the first row in the list we were
 * given, so the caller chooses the order. One action therefore cannot mail
 * the same person twice.
 */
export function inviteRecipients(guests: InviteGuest[]): InviteSelection {
  const seen = new Set<string>();
  const recipients: InviteRecipient[] = [];
  let skippedNoEmail = 0;

  for (const guest of guests) {
    const email = guest.email?.trim().toLowerCase() ?? "";
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ guest, email });
  }

  return { recipients, skippedNoEmail };
}

/** The public RSVP page for one guest. The token is the credential. */
export function rsvpUrl(origin: string, token: string): string {
  const base = origin.trim().replace(/\/+$/, "");
  return `${base}/rsvp/${encodeURIComponent(token)}`;
}

/**
 * Wall-clock start, the way Event.date is stored: the host's clock encoded
 * as UTC. Noon means they never set a time (see parseStart). A missing date
 * still names both fields, so the email always says when — or that it isn't
 * decided yet.
 */
export function inviteSchedule(date: Date | null): { date: string; time: string } {
  if (!date || Number.isNaN(date.getTime())) {
    return { date: "Date to be announced", time: "Time to be announced" };
  }
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const hasTime = date.getUTCHours() !== 12 || date.getUTCMinutes() !== 0;
  const timeLabel = hasTime
    ? date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "Time to be announced";
  return { date: dateLabel, time: timeLabel };
}

export type RsvpInviteMessage = {
  subject: string;
  text: string;
  html: string;
};

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The invitation. `text` is the plain-text part; `html` is the same words
 * with the link clickable. Neither part is given a budget, a price, or a
 * cent amount to mention — those fields are not arguments.
 */
export function rsvpInviteMessage(input: {
  title: string;
  date: Date | null;
  hostName: string;
  guestName: string;
  link: string;
}): RsvpInviteMessage {
  const title = oneLine(input.title) || "Untitled event";
  const host = oneLine(input.hostName) || "the host";
  const guest = oneLine(input.guestName) || "there";
  const link = input.link.trim();
  const when = inviteSchedule(input.date);
  const subject = stripHeader(`You're invited to ${title}`);
  const text = [
    `Hi ${guest},`,
    "",
    `${host} invited you to ${title}.`,
    "",
    `Date: ${when.date}`,
    `Time: ${when.time}`,
    "",
    "RSVP:",
    link,
    "",
    `— ${host} via Hosty`,
  ].join("\n");
  const html = [
    `<p>Hi ${escapeHtml(guest)},</p>`,
    `<p>${escapeHtml(host)} invited you to <strong>${escapeHtml(title)}</strong>.</p>`,
    `<p>Date: ${escapeHtml(when.date)}<br>Time: ${escapeHtml(when.time)}</p>`,
    `<p><a href="${escapeHtml(link)}">RSVP</a></p>`,
    `<p>${escapeHtml(link)}</p>`,
    `<p>— ${escapeHtml(host)} via Hosty</p>`,
  ].join("\n");
  return { subject, text, html };
}

/** What the host sees after Send invites. Both numbers, including zero. */
export function inviteResultCopy(sent: number, skippedNoEmail: number): string {
  const invites = `${sent} ${sent === 1 ? "invite" : "invites"}`;
  const skipped = `${skippedNoEmail} ${skippedNoEmail === 1 ? "guest" : "guests"} with no email`;
  return `Sent ${invites}. Skipped ${skipped}.`;
}
