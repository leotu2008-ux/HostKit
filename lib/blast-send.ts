import { db } from "@/lib/db";
import {
  personalize,
  phoneRecipientsFor,
  recipientsFor,
  segmentsFor,
  type PhoneRecipient,
  type Recipient,
  type Segment,
} from "@/lib/blasts";
import { isEmailConfigured, sendEmails } from "@/lib/email/send";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { notify } from "@/lib/notify";

export type BlastOutcome = {
  id: string;
  provider: "resend" | "manual";
  recipients: Recipient[];
  /** Guests texted (0 when the host didn't ask, or Twilio isn't configured). */
  smsCount: number;
  /** Who would have been texted, for the composer's count. */
  phoneRecipients: PhoneRecipient[];
};

/** The text: the message, personalised, with who it's from. */
export function smsText(body: string, name: string, host: string): string {
  const message = personalize(body, name).trim();
  return `${message}\n— ${host} via Hosty. Reply STOP to opt out.`;
}

/** The email: the message, personalised, signed like the text. Replies go
 *  to the host, so a reply is how a guest asks to stop. */
export function emailText(body: string, name: string, host: string, event: string): string {
  const message = personalize(body, name).trim();
  return `${message}\n\n— ${host} via Hosty. Reply to this email to stop getting updates about ${event}.`;
}

/**
 * Sends a blast to a segment of the guest list and records it. With Resend
 * configured the mail goes out, reply-to the host; otherwise the blast is
 * recorded as manual and the caller shows the host who to paste it to.
 * With `sms` and Twilio configured, guests with a verified phone are also
 * texted (SMS_CAP at most). Shared by the web composer and the iOS API.
 */
export async function sendBlast(input: {
  eventId: string;
  host: { name: string; email: string };
  segment: Segment;
  subject: string;
  body: string;
  sms?: boolean;
}): Promise<BlastOutcome> {
  const [guests, event] = await Promise.all([
    db.guest.findMany({
      where: { eventId: input.eventId },
      select: {
        name: true,
        email: true,
        rsvpStatus: true,
        checkedInAt: true,
        userId: true,
        user: { select: { phone: true, phoneVerifiedAt: true } },
      },
    }),
    db.event.findUnique({
      where: { id: input.eventId },
      select: { title: true, date: true, endDate: true, status: true },
    }),
  ]);
  // A stale composer or an API call can still name "came"; only send it
  // once the night has happened and the door was run.
  if (event && !segmentsFor(event, guests).includes(input.segment)) {
    throw new Error("“Came” opens after the night, once guests were checked in at the door.");
  }
  const recipients = recipientsFor(input.segment, guests);
  const phoneRecipients = phoneRecipientsFor(input.segment, guests);

  let provider: BlastOutcome["provider"] = "manual";
  if (isEmailConfigured() && recipients.length > 0) {
    await sendEmails(
      recipients.map((r) => ({
        to: r.email,
        subject: input.subject,
        text: emailText(input.body, r.name, input.host.name, event?.title ?? "this event"),
        replyTo: input.host.email,
        // Its own From (RESEND_FROM_BLAST), so a complaint on a blast
        // cannot sink password resets.
        stream: "blast" as const,
        template: "blast",
      })),
    );
    provider = "resend";
  }

  let smsCount = 0;
  if (input.sms && isSmsConfigured()) {
    for (const r of phoneRecipients) {
      try {
        await sendSms(r.phone, smsText(input.body, r.name, input.host.name));
        smsCount += 1;
      } catch (error) {
        console.error("[blast] sms failed", error);
      }
    }
  }

  const row = await db.blast.create({
    data: {
      eventId: input.eventId,
      segment: input.segment,
      subject: input.subject,
      body: input.body,
      recipientCount: recipients.length,
      provider,
      smsCount,
    },
  });

  // Account registrations in the segment also get it in their Inbox (and
  // by push, when that exists) — the email already went, so no email here.
  const emails = new Set(recipients.map((r) => r.email));
  const accountIds = guests
    .filter((g) => g.userId && g.email && emails.has(g.email.toLowerCase()))
    .map((g) => g.userId as string);
  await notify(accountIds, {
    kind: "blast",
    title: `${event?.title ?? "Your event"}: ${input.subject}`,
    body: input.body.length > 140 ? `${input.body.slice(0, 137)}…` : input.body,
    eventId: input.eventId,
  });
  return { id: row.id, provider, recipients, smsCount, phoneRecipients };
}
