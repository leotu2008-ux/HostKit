import { z } from "zod";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { serializeEvent } from "@/lib/api/serialize";
import { publishEvent } from "@/lib/publish";
import { readyToPublish } from "@/lib/brief";

const schema = z.object({
  published: z.boolean(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  requiresApproval: z.boolean().optional(),
});

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

  if (parsed.data.published && !readyToPublish(event)) {
    return apiError(
      "Give this a name, a date, a city, a headcount and a budget before publishing.",
      422,
    );
  }

  const { event: updated } = await publishEvent({
    eventId: event.id,
    user: { id: user.id, schoolDomain: user.schoolDomain },
    published: parsed.data.published,
    visibility: parsed.data.visibility,
    requiresApproval: parsed.data.requiresApproval,
  });
  return json({ event: serializeEvent(updated, updated._count.guests, true) });
}
