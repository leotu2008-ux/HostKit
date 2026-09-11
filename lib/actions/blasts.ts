"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireEvent } from "@/lib/session";
import { SEGMENT_KEYS, type Segment } from "@/lib/blasts";
import { sendBlast } from "@/lib/blast-send";

export type BlastFormState =
  | {
      error?: string;
      sent?: { provider: "resend" | "manual"; count: number; emails: string[]; smsCount: number };
    }
  | undefined;

const schema = z.object({
  eventId: z.string().min(1),
  segment: z.enum(SEGMENT_KEYS as [Segment, ...Segment[]]),
  subject: z.string().trim().min(1, "Give it a subject.").max(150),
  body: z.string().trim().min(1, "Write the message.").max(5000),
  sms: z.string().optional(),
});

export async function sendBlastAction(
  _prev: BlastFormState,
  formData: FormData,
): Promise<BlastFormState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    segment: formData.get("segment"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    sms: formData.get("sms") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the message." };

  const { user, event } = await requireEvent(parsed.data.eventId);
  if (!user) return { error: "Sign in to send updates." };

  try {
    const outcome = await sendBlast({
      eventId: event.id,
      host: { name: user.name, email: user.email },
      segment: parsed.data.segment,
      subject: parsed.data.subject,
      body: parsed.data.body,
      sms: parsed.data.sms === "on",
    });
    refresh();
    return {
      sent: {
        provider: outcome.provider,
        count: outcome.recipients.length,
        emails: outcome.recipients.map((r) => r.email),
        smsCount: outcome.smsCount,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't send that." };
  }
}
