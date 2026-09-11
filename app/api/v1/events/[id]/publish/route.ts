import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, ownedEvent, readJson } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";

const schema = z.object({ published: z.boolean() });

/** Publishes or unpublishes a night the host owns. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  const event = await ownedEvent(id, user.id);
  if (!event) return apiError("Not found.", 404);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say whether to publish.", 400);

  const updated = await db.event.update({
    where: { id: event.id },
    data: { published: parsed.data.published },
    include: { owner: { select: { name: true } }, ...goingCount },
  });
  return json({
    event: serializeEvent(updated, updated._count.guests, user.id),
  });
}
