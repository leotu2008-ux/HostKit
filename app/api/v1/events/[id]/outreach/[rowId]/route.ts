import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { loadOutreach } from "@/lib/api/outreach";

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

  const result = await db.eventCollaborator.updateMany({
    where: { id: rowId, eventId: event.id },
    data: { status: parsed.data.status },
  });
  if (result.count === 0) return apiError("Not found.", 404);
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
