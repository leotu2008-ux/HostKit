import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, apiUser, json, manageableEvent, readJson } from "@/lib/api/http";
import { loadOutreach } from "@/lib/api/outreach";

/** Everyone the host is lining up, each with a drafted message. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);
  return json({ rows: await loadOutreach(event, user?.name ?? "the host") });
}

const addSchema = z.object({
  kind: z.enum(["VENUE", "SPEAKER", "COHOST"]),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  detail: z.string().trim().max(200).nullable().optional(),
});

/** Adds a venue, speaker or cohost to reach out to. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await apiUser(request);
  const event = await manageableEvent(request, id, user?.id ?? null);
  if (!event) return apiError(user ? "Not found." : "Sign in first.", user ? 404 : 401);

  const parsed = addSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);

  await db.eventCollaborator.create({
    data: {
      eventId: event.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      detail: parsed.data.detail || null,
    },
  });
  return json({ rows: await loadOutreach(event, user?.name ?? "the host") }, 201);
}
