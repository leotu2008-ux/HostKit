"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { registerGuest } from "@/lib/registration";

export type RegisterState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({ eventId: z.string().min(1) });

/**
 * The public Register button. Needs an account — the event registers the
 * account's email, which is what the host's blasts go to. The rules live in
 * lib/registration.ts so the iOS app follows the same ones.
 */
export async function registerForEventAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { error: "That event isn’t listed anymore." };

  const user = await getCurrentUser();
  const result = await registerGuest({ eventId: parsed.data.eventId, viewer: user });
  if (!result.ok) return { error: result.error };

  refresh();
  return { ok: true };
}
