"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/session";
import type { CollaboratorKind, CollaboratorStatus } from "@/generated/prisma/enums";

const KINDS = ["VENUE", "SPEAKER", "COHOST"] as const;
const STATUSES = ["PENDING", "CONFIRMED", "DECLINED"] as const;

const addSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(KINDS),
  name: z.string().trim().min(1, "Add a name.").max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(200).optional(),
});

export type CollaboratorFormState = { error?: string } | undefined;

export async function addCollaboratorAction(
  _prev: CollaboratorFormState,
  formData: FormData,
): Promise<CollaboratorFormState> {
  const parsed = addSchema.safeParse({
    eventId: formData.get("eventId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    detail: formData.get("detail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await requireEvent(parsed.data.eventId);
  await db.eventCollaborator.create({
    data: {
      eventId: parsed.data.eventId,
      kind: parsed.data.kind as CollaboratorKind,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      detail: parsed.data.detail || null,
    },
  });
  refresh();
  return undefined;
}

export async function setCollaboratorStatusAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  await requireEvent(eventId);
  await db.eventCollaborator.updateMany({
    where: { id: collaboratorId, eventId },
    data: { status: status as CollaboratorStatus },
  });
  refresh();
}

export async function removeCollaboratorAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  await requireEvent(eventId);
  await db.eventCollaborator.deleteMany({
    where: { id: collaboratorId, eventId },
  });
  refresh();
}
