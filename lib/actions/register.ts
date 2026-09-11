"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { registerGuest } from "@/lib/registration";

export type RegisterState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(120),
});

/**
 * Public registration for a published night. Guests do not need an account —
 * same idea as the RSVP token, but the event page is the invitation. The
 * rules live in lib/registration.ts so the iOS app follows the same ones.
 */
export async function registerForEventAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await getCurrentUser();
  const result = await registerGuest({
    eventId: parsed.data.eventId,
    name: parsed.data.name,
    email: parsed.data.email,
    viewerId: user?.id ?? null,
  });
  if (!result.ok) return { error: result.error };

  refresh();
  return { ok: true };
}
