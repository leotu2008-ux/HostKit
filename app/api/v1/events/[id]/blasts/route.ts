import { z } from "zod";
import type { EventStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { phoneRecipientsFor, recipientsFor, SEGMENT_KEYS, SEGMENTS, segmentsFor, type Segment } from "@/lib/blasts";
import { BlastError, sendBlast } from "@/lib/blast-send";
import { isEmailConfigured } from "@/lib/email/send";
import { isSmsConfigured } from "@/lib/sms/twilio";

async function feed(event: { id: string; date: Date | null; endDate: Date | null; status: EventStatus }) {
  const eventId = event.id;
  const [blasts, guests] = await Promise.all([
    db.blast.findMany({ where: { eventId }, orderBy: { sentAt: "desc" } }),
    db.guest.findMany({
      where: { eventId },
      select: {
        name: true,
        email: true,
        rsvpStatus: true,
        checkedInAt: true,
        user: { select: { phone: true, phoneVerifiedAt: true } },
      },
    }),
  ]);
  return {
    canSend: isEmailConfigured(),
    canText: isSmsConfigured(),
    segments: segmentsFor(event, guests).map((key) => ({
      key,
      label: SEGMENTS[key],
      count: recipientsFor(key, guests).length,
      phoneCount: phoneRecipientsFor(key, guests).length,
    })),
    blasts: blasts.map((b) => ({
      id: b.id,
      segment: b.segment,
      subject: b.subject,
      body: b.body,
      recipientCount: b.recipientCount,
      smsCount: b.smsCount,
      provider: b.provider,
      sentAt: b.sentAt.toISOString(),
    })),
  };
}

/** Past blasts, the segments with live counts, and whether email / SMS are on. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);
  return json(await feed(event));
}

const sendSchema = z.object({
  segment: z.enum(SEGMENT_KEYS as [Segment, ...Segment[]]),
  subject: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(5000),
  sms: z.boolean().optional(),
});

/** Sends a blast (or records it for manual sending) and returns who it
 *  went to, so the app can offer copy / mail when email isn't configured. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const event = await manageableEvent(request, id, user.id);
  if (!event) return apiError("Not found.", 404);

  const parsed = sendSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the message.", 400);

  try {
    const outcome = await sendBlast({
      eventId: event.id,
      host: { name: user.name, email: user.email },
      ...parsed.data,
    });
    return json({ ...outcome, ...(await feed(event)) }, 201);
  } catch (error) {
    if (error instanceof BlastError) return apiError(error.message, error.status);
    return apiError(error instanceof Error ? error.message : "Couldn't send that.", 502);
  }
}
