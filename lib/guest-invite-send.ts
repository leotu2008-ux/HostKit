import type { OutgoingEmail } from "@/lib/email/resend";
import { sendEmails } from "@/lib/email/send";
import {
  inviteRecipients,
  rsvpInviteMessage,
  rsvpUrl,
  type InviteGuest,
} from "@/lib/guest-invites";

/**
 * Emails RSVP links through the one send path (lib/email/send.ts).
 *
 * That path is also the delivery gate: Vercel Production is the only place
 * mail leaves, unless SMTP points at a local catcher. This file does not
 * open a second provider and does not decide the gate for itself.
 *
 * Not a `"use server"` module. The action in lib/actions/guests.ts is the
 * public endpoint and the ownership check; this is the writer it calls.
 */

export async function deliverRsvpInvites(input: {
  guests: InviteGuest[];
  title: string;
  date: Date | null;
  hostName: string;
  origin: string;
  replyTo?: string | null;
}): Promise<{ sent: number; skippedNoEmail: number }> {
  const { recipients, skippedNoEmail } = inviteRecipients(input.guests);
  if (recipients.length === 0) return { sent: 0, skippedNoEmail };

  const replyTo = input.replyTo?.trim() || undefined;
  const emails: OutgoingEmail[] = recipients.map(({ guest, email }) => {
    const message = rsvpInviteMessage({
      title: input.title,
      date: input.date,
      hostName: input.hostName,
      guestName: guest.name,
      link: rsvpUrl(input.origin, guest.rsvpToken),
    });
    return {
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(replyTo ? { replyTo } : {}),
      template: "rsvp_invite",
    };
  });

  const sent = await sendEmails(emails);
  return { sent, skippedNoEmail };
}
