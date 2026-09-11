import { apiError, apiUser, json } from "@/lib/api/http";

/** Who the bearer token belongs to — lets the app check a saved session. */
export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return apiError("Sign in first.", 401);
  return json({ user });
}
