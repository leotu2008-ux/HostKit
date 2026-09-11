import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";

const schema = z.object({ published: z.boolean() });

/**
 * Publishes or unpublishes a night. This is the step that needs an account:
 * a draft the device made is claimed by the signed-in host here, in the same
 * request, so "sign in, then publish" is one round trip for the app.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  if (!user) return apiError("Sign in to publish.", 401);
  const event = await manageableEvent(request, id, user.id);
  if (!event) return apiError("Not found.", 404);

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say whether to publish.", 400);

  const updated = await db.event.update({
    where: { id: event.id },
    data: {
      published: parsed.data.published,
      ...(event.ownerId === null
        ? { ownerId: user.id, schoolDomain: user.schoolDomain }
        : {}),
    },
    include: { owner: { select: { name: true } }, ...goingCount },
  });
  return json({ event: serializeEvent(updated, updated._count.guests, true) });
}
