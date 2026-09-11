import { db } from "@/lib/db";
import { personalize, recipientsFor, type Recipient, type Segment } from "@/lib/blasts";
import { isEmailConfigured, sendEmails } from "@/lib/email/resend";
import { notify } from "@/lib/notify";

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
    select: { name: true, email: true, rsvpStatus: true, userId: true },
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

  // Account registrations in the segment also get it in their Inbox (and
  // by push, when that exists) — the email already went, so no email here.
  const emails = new Set(recipients.map((r) => r.email));
  const accountIds = guests
    .filter((g) => g.userId && g.email && emails.has(g.email.toLowerCase()))
    .map((g) => g.userId as string);
  const event = await db.event.findUnique({ where: { id: input.eventId }, select: { title: true } });
  await notify(accountIds, {
    kind: "blast",
    title: `${event?.title ?? "Your event"}: ${input.subject}`,
    body: input.body.length > 140 ? `${input.body.slice(0, 137)}…` : input.body,
    eventId: input.eventId,
  });
  return { id: row.id, provider, recipients };
}
