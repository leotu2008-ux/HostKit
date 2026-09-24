import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { loadOutreach } from "@/lib/api/outreach";
import { COLLABORATOR_KIND_LABEL } from "@/lib/outreach";
import { record } from "@/lib/activity";
import { rememberCollaborator } from "@/lib/vendor-book";

const patchSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED"]),
});

/** Marks a collaborator confirmed, declined, or back to pending. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const { id, rowId } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Pick a status.", 400);

  const before = await db.eventCollaborator.findFirst({
    where: { id: rowId, eventId: event.id },
    select: { kind: true, name: true, status: true },
  });
  const result = await db.eventCollaborator.updateMany({
    where: { id: rowId, eventId: event.id },
    data: { status: parsed.data.status },
  });
  if (result.count === 0) return apiError("Not found.", 404);
  // Same as the web's setCollaboratorStatusAction: only the move into
  // CONFIRMED is news for the thread and the vendor book.
  if (before && parsed.data.status === "CONFIRMED" && before.status !== "CONFIRMED") {
    await record(event.id, {
      actor: "host",
      kind: "collaborator_confirmed",
      title: `${COLLABORATOR_KIND_LABEL[before.kind]} confirmed: ${before.name}`,
    });
    // Best-effort: the vendor book must never fail a status change that
    // already committed.
    try {
      await rememberCollaborator(rowId);
    } catch (error) {
      console.error("rememberCollaborator failed", error);
    }
  }
  return json({ rows: await loadOutreach(event, user?.name ?? "the host") });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const { id, rowId } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  await db.eventCollaborator.deleteMany({ where: { id: rowId, eventId: event.id } });
  return json({ rows: await loadOutreach(event, user?.name ?? "the host") });
}
