import { z } from "zod";
import { registerGuest } from "@/lib/registration";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(120),
});

const STATUS_FOR_CODE = { not_listed: 404, full: 409, declined: 409 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Check your details.", 400);
  }

  const viewer = await apiUser(request);
  const result = await registerGuest({
    eventId: id,
    name: parsed.data.name,
    email: parsed.data.email,
    viewerId: viewer?.id ?? null,
  });
  if (!result.ok) return apiError(result.error, STATUS_FOR_CODE[result.code]);
  return json({ ok: true });
}
