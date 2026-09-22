import { db } from "@/lib/db";
import { AccountError } from "@/lib/account";
import { EmailSendError, isEmailConfigured, sendEmails } from "@/lib/email/send";

/** Adds someone to the list and emails them a confirmation. Signing up again with the same address updates the name and sends the note again. */
export async function joinEmailList(input: { name: string; email: string }): Promise<{ email: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  await db.emailListEntry.upsert({
    where: { email },
    create: { email, name },
    update: { name },
  });
  await sendWaitlistConfirmation({ name, email });
  return { email };
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || "there";
}

function confirmationFailureMessage(email: string, error: unknown): string {
  if (error instanceof EmailSendError && error.cause === "recipient") {
    return `We couldn’t send the confirmation email to ${email}. Check the address and try again.`;
  }
  return `We couldn’t send the confirmation email to ${email}. It’s on our side, not yours — try again in a moment.`;
}

/** The note that says they’re on the waitlist. Without a transport in production, signup refuses rather than pretend the email went out. */
export async function sendWaitlistConfirmation(input: { name: string; email: string }): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const text = [
    `Hi ${firstName(input.name)},`,
    "",
    "Thanks for joining the waitlist! We’ll keep you posted whenever updates happen.",
  ].join("\n");

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new AccountError(
        "Email isn’t set up on this server yet, so we couldn’t send your confirmation.",
        503,
      );
    }
    console.log(`[waitlist] no email configured — confirmation for ${email}`);
    return;
  }

  try {
    await sendEmails([
      {
        to: email,
        subject: "Thanks for joining the Hosty waitlist",
        text,
      },
    ]);
  } catch (error) {
    const status = error instanceof EmailSendError && error.cause === "recipient" ? 400 : 502;
    throw new AccountError(confirmationFailureMessage(email, error), status);
  }
}
