import { db } from "@/lib/db";
import { personalize, recipientsFor, type Recipient, type Segment } from "@/lib/blasts";
import { isEmailConfigured, sendEmails } from "@/lib/email/resend";

export type BlastOutcome = {
  id: string;
  provider: "resend" | "manual";
  recipients: Recipient[];
};

/**
 * Sends a blast to a segment of the guest list and records it. With Resend
 * configured the mail goes out, reply-to the host; otherwise the blast is
 * recorded as manual and the caller shows the host who to paste it to.
 * Shared by the web composer and the iOS API.
 */
export async function sendBlast(input: {
  eventId: string;
  host: { name: string; email: string };
  segment: Segment;
  subject: string;
  body: string;
}): Promise<BlastOutcome> {
  const guests = await db.guest.findMany({
    where: { eventId: input.eventId },
    select: { name: true, email: true, rsvpStatus: true },
  });
  const recipients = recipientsFor(input.segment, guests);

  let provider: BlastOutcome["provider"] = "manual";
  if (isEmailConfigured() && recipients.length > 0) {
    await sendEmails(
      recipients.map((r) => ({
        to: r.email,
        subject: input.subject,
        text: personalize(input.body, r.name),
        replyTo: input.host.email,
      })),
    );
    provider = "resend";
  }

  const row = await db.blast.create({
    data: {
      eventId: input.eventId,
      segment: input.segment,
      subject: input.subject,
      body: input.body,
      recipientCount: recipients.length,
      provider,
    },
  });
  return { id: row.id, provider, recipients };
}
