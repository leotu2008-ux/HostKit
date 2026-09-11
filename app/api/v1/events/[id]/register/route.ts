import { registerGuest } from "@/lib/registration";
import { apiError, apiUser, json } from "@/lib/api/http";

const STATUS_FOR_CODE = { sign_in: 401, not_listed: 404, full: 409, declined: 409 } as const;

/** Registers the signed-in account for a night. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await apiUser(request);
  const result = await registerGuest({ eventId: id, viewer });
  if (!result.ok) return apiError(result.error, STATUS_FOR_CODE[result.code]);
  return json({ ok: true });
}
