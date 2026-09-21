"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";

/** Re-validates the hidden fields the venues page rendered — a host never
 *  types these, but the form is still a POST from a browser, so the numbers
 *  and lengths get checked the same as any other input. */
const attachSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(300).optional().default(""),
  externalId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * Adds an Apple Maps venue as a VENUE collaborator, in the exact shape
 * lib/event-create.ts:82-97 writes at event creation — email stays null,
 * since Apple Maps never returns one; the host supplies it later from
 * Outreach.
 *
 * Idempotent on externalId: pressing this twice (a slow network, a second
 * tab) must reuse the same collaborator rather than double it up in
 * Outreach. There's no unique index on externalId to lean on for this — the
 * column also holds catalog listing ids from other sources — so it's a
 * lookup-then-create rather than a database constraint.
 */
export async function attachVenueAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  const outreachHref = `/events/${event.id}/outreach`;

  const parsed = attachSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    website: formData.get("website") ?? undefined,
    externalId: formData.get("externalId"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });

  // These fields are hidden inputs the page itself rendered, never typed by
  // hand, so a failure here means the form was tampered with rather than a
  // host mistake — there's nothing to show them, just land back on Outreach.
  if (parsed.success) {
    const data = parsed.data;
    const existing = await db.eventCollaborator.findFirst({
      where: { eventId: event.id, kind: "VENUE", externalId: data.externalId },
    });

    if (!existing) {
      await db.eventCollaborator.create({
        data: {
          eventId: event.id,
          kind: "VENUE",
          name: data.name,
          detail: data.address || null,
          phone: data.phone || null,
          website: data.website || null,
          source: "APPLE_MAPS",
          externalId: data.externalId,
          lat: data.lat,
          lng: data.lng,
        },
      });
    }
  }

  redirect(outreachHref);
}
