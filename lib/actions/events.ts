"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { currentProfile, getCurrentUser, requireEvent, requireUser } from "@/lib/session";
import { newClaimToken, rememberDraftClaim } from "@/lib/drafts";
import { publishEvent } from "@/lib/publish";
import { LIMITS, RateLimitError, assertRateLimit, clientIp } from "@/lib/rate-limit";
import { readyToPublish } from "@/lib/brief";
import { record } from "@/lib/activity";

/**
 * Create event, the new way: mint a blank row and land the host in its
 * workspace — no intake form, no facts required up front. The brief action
 * (Task 1b) fills the row in from there; this is deliberately the smallest
 * possible write.
 */
export async function createBlankEventAction(): Promise<void> {
  const user = await currentProfile();
  const claimToken = user ? null : newClaimToken();
  if (!user) {
    // Unchanged from createEventAction: drafts without an account are cheap
    // rows anyone can create, so a few an hour per address.
    try {
      await assertRateLimit(`draft:ip:${clientIp(await headers())}`, ...LIMITS.draft.perIp);
    } catch (error) {
      if (error instanceof RateLimitError) redirect("/events?limit=1");
      throw error;
    }
  }
  const event = await db.event.create({
    data: {
      ownerId: user?.id ?? null,
      claimToken,
      schoolDomain: user?.schoolDomain ?? null,
      // Everything else rides the schema defaults: "Untitled event", MIXER,
      // 0 guests, 0 budget, "" city. No plan is generated — there are no
      // facts to plan from yet, which is the whole point of this change.
    },
  });
  if (claimToken) await rememberDraftClaim({ id: event.id, token: claimToken });
  await record(event.id, {
    actor: "system",
    kind: "event_created",
    title: "Event created",
    body: "Fill in the brief and the agent gets going.",
  });
  redirect(`/events/${event.id}`);
}

export async function publishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(`/events/${eventId}`)}&publish=1`,
    );
  }
  const { event } = await requireEvent(eventId);
  // No error surface on this action (it's wired straight to a submit
  // button), so an incomplete brief bounces back to the Overview page,
  // which reads `?publish=incomplete` and renders the message.
  if (!readyToPublish(event)) {
    redirect(`/events/${eventId}?publish=incomplete`);
  }
  const profile = await currentProfile();
  await publishEvent({
    eventId: event.id,
    user: { id: user.id, schoolDomain: profile?.schoolDomain ?? null },
    published: true,
  });
  await record(event.id, {
    actor: "host",
    kind: "published",
    title: "Published — guests can register",
    href: `/e/${event.id}`,
  });
  refresh();
}

export async function unpublishEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const user = await requireUser(`/events/${eventId}`);
  const { event } = await requireEvent(eventId);
  const profile = await currentProfile();
  await publishEvent({
    eventId: event.id,
    user: { id: user.id, schoolDomain: profile?.schoolDomain ?? null },
    published: false,
  });
  await record(event.id, { actor: "host", kind: "unpublished", title: "Unpublished" });
  refresh();
}

const VISIBILITY_VALUES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

/** Who can find the night. Changing it doesn't publish or unpublish. */
export async function setVisibilityAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const raw = String(formData.get("visibility") ?? "");
  if (!(VISIBILITY_VALUES as readonly string[]).includes(raw)) return;
  const { event } = await requireEvent(eventId);
  await db.event.update({
    where: { id: event.id },
    data: { visibility: raw as (typeof VISIBILITY_VALUES)[number] },
  });
  refresh();
}

/** Whether registrations wait for the host's approval. */
export async function setApprovalAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const on = String(formData.get("requiresApproval") ?? "") === "on";
  const { event } = await requireEvent(eventId);
  await db.event.update({ where: { id: event.id }, data: { requiresApproval: on } });
  refresh();
}

export async function setPublishedAction(formData: FormData) {
  const published = String(formData.get("published") ?? "") === "on";
  if (published) return publishEventAction(formData);
  return unpublishEventAction(formData);
}
