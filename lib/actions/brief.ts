"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import { parseCents } from "@/lib/money";
import { parseStart } from "@/lib/when";
import { snapQuarterHours } from "@/lib/duration";
import { briefIsComplete, eventTypeForKind, FALLBACK_TYPE, namedVenue, UNTITLED } from "@/lib/brief";
import { clientIp } from "@/lib/rate-limit";
import { runAgent } from "@/lib/agent/run";
import { record } from "@/lib/activity";
import { promoteWaitlist } from "@/lib/waitlist";

export type BriefFormState = { error?: string; saved?: boolean } | undefined;

// Everything but eventId is optional: the Brief tab is one form a host fills
// in over several visits, not a single all-or-nothing submission.
const schema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  kind: z.string().trim().max(60).optional(),
  date: z.string().trim().optional(),
  time: z.string().trim().optional(),
  // Fractional: components/duration-wheel.tsx submits quarter hours, so "1.5"
  // is a real answer. Snapped below rather than rejected — a value between
  // steps can only come from something other than the wheel.
  durationHours: z.coerce.number().min(0.25).max(24).optional(),
  // Any city, not just the four Hosty scouts: components/city-field.tsx
  // normalises to a suggestion's exact name when the host picks one, and free
  // text is stored as typed. Scoutability stays isCity's question.
  city: z.string().trim().max(80).optional(),
  guestCount: z.coerce.number().int().min(0).max(100_000).optional(),
  budget: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(200).optional(),
});

/** Saves the whole Brief tab in one shot. Every visible field rides in the
 *  same form, so a save always writes the full set — there's no per-field
 *  PATCH here. */
export async function saveBriefAction(
  _prev: BriefFormState,
  formData: FormData,
): Promise<BriefFormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  const { event } = await requireEvent(input.eventId);

  let budgetTotalCents = event.budgetTotalCents;
  if (input.budget !== undefined) {
    if (input.budget === "") {
      // An emptied field means "no budget set yet", not a typo — the same
      // "not filled in" sentinel guestCount 0 and city "" already use.
      budgetTotalCents = 0;
    } else {
      const cents = parseCents(input.budget);
      if (cents === null) return { error: "That planning budget doesn't look right." };
      budgetTotalCents = cents;
    }
  }

  const date = parseStart(input.date ?? "", input.time ?? "");
  if (input.date && !date) {
    return { error: "That date and time don't look right." };
  }

  const trimmedKind = (input.kind ?? "").trim();
  const kind = trimmedKind || null;
  // Only re-derive the planning type when the kind text itself changed — a
  // host who corrected it must not lose that on an unrelated field's save.
  const type =
    trimmedKind !== (event.kind ?? "")
      ? (eventTypeForKind(trimmedKind) ?? FALLBACK_TYPE)
      : event.type;

  const title = input.title?.trim() || UNTITLED;
  const description = input.description?.trim() || null;
  const durationHours =
    input.durationHours === undefined
      ? event.durationHours
      : snapQuarterHours(input.durationHours);
  const city = input.city ?? event.city;
  const guestCount = input.guestCount ?? event.guestCount;
  const address = input.address?.trim() || "";

  await db.event.update({
    where: { id: event.id },
    data: {
      title,
      kind,
      type,
      date,
      durationHours,
      city,
      guestCount,
      budgetTotalCents,
      description,
      vibe: description,
      address: address || null,
    },
  });

  if (address) {
    // A host who types a venue address here is telling the agent it can skip
    // venue search — this is what lets it later find that out.
    const existing = namedVenue(
      await db.eventCollaborator.findMany({
        where: { eventId: event.id, kind: "VENUE" },
        orderBy: { createdAt: "asc" },
      }),
      event.address,
    );
    if (existing) {
      await db.eventCollaborator.update({ where: { id: existing.id }, data: { detail: address } });
    } else {
      await db.eventCollaborator.create({
        data: { eventId: event.id, kind: "VENUE", name: address, detail: address, source: "MANUAL" },
      });
    }
  }

  // Every visible field rides in the same form, so a save that only touched
  // one field must not read as "everything changed" — diff against what was
  // actually there before this write.
  const changedFields: string[] = [];
  if (title !== event.title) changedFields.push("Title");
  if ((kind ?? "") !== (event.kind ?? "")) changedFields.push("Kind");
  if ((date?.getTime() ?? null) !== (event.date?.getTime() ?? null)) changedFields.push("Date");
  if (durationHours !== event.durationHours) changedFields.push("Duration");
  if (city !== event.city) changedFields.push("City");
  if (guestCount !== event.guestCount) changedFields.push("Guests");
  if (budgetTotalCents !== event.budgetTotalCents) changedFields.push("Budget");
  if (description !== event.description) changedFields.push("Vibe");
  if ((address || null) !== event.address) changedFields.push("Address");
  if (changedFields.length > 0) {
    await record(event.id, {
      actor: "host",
      kind: "brief_saved",
      title: "Brief updated",
      body: changedFields.join(" · "),
    });
  }
  const updated = { title, kind, type, date, durationHours, city, guestCount, budgetTotalCents, vibe: description, description };

  if (guestCount > event.guestCount) await promoteWaitlist(event.id);

  refresh();

  // A brief with every fact in it is the agent's cue: it doesn't wait to be
  // asked. Running it again on an unchanged brief is runAgent's problem, not
  // this action's — the AgentRun row's briefHash is what makes a resave that
  // touched nothing a no-op.
  if (briefIsComplete(updated)) {
    // Read the request data BEFORE after(): runAgent must also be callable
    // from the cron, which has no headers to read.
    const ipKey = event.ownerId ? null : clientIp(await headers());
    // after() keeps the invocation alive via waitUntil, so the host gets the
    // saved brief immediately and the agent works behind it. Nothing in here
    // can refresh() anything — the response is already gone; the Overview
    // feed's poll is what shows the result.
    after(async () => {
      await runAgent(event.id, { reason: "brief", ipKey });
    });
  }

  return { saved: true };
}
