import { z } from "zod";
import { apiError, json, readJson } from "@/lib/api/http";
import { AccountError, resetPassword } from "@/lib/account";

/** `{ token, password }` → sets the new password. The web reset page uses
 *  the same rules; this exists for clients that handle the link themselves. */
export async function POST(request: Request) {
  const parsed = z
    .object({ token: z.string().min(10), password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters.") })
    .safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof AccountError) return apiError(error.message, error.status);
    throw error;
  }
}
