"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { registerGuest, type RegistrationState } from "@/lib/registration";
import { record } from "@/lib/activity";

const RSVP_TITLE: Record<"going" | "pending" | "waitlisted", (name: string) => string> = {
  going: (name) => `${name} is going`,
  pending: (name) => `${name} asked to come`,
  waitlisted: (name) => `${name} joined the waitlist`,
};

export type RegisterState = { error?: string; ok?: boolean; state?: RegistrationState } | undefined;

const schema = z.object({ eventId: z.string().min(1) });

/**
 * The public Register button. Needs an account — the event registers the
 * account's email, which is what the host's blasts go to. The rules live in
 * lib/registration.ts so the iOS app follows the same ones. The result says
 * whether you're in, waiting for the host, or on the waitlist.
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

  // Only a real, new decision is worth a line — re-registering into the same
  // state (an existing row that already answers it) is a no-op, not news.
  if (result.changed) {
    await record(parsed.data.eventId, {
      actor: "system",
      kind: "guest_rsvp",
      title: RSVP_TITLE[result.state](user?.name?.trim() || "A guest"),
    });
  }

  refresh();
  return { ok: true, state: result.state };
}
