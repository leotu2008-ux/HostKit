import { z } from "zod";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { ClubError, addMember, canManageClub, clubByHandle, removeMember } from "@/lib/clubs";

async function managed(handle: string, request: Request) {
  const viewer = await apiUser(request);
  if (!viewer) return { error: apiError("Sign in first.", 401) };
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(viewer.id, club.id))) return { error: apiError("Not found.", 404) };
  return { viewer, club };
}

/** `{ email }` → adds an existing account as an admin. */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const got = await managed((await params).handle, request);
  if ("error" in got) return got.error;
  const parsed = z.object({ email: z.string().email() }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Enter an email.", 400);
  try {
    const userId = await addMember(got.club.id, parsed.data.email);
    return json({ ok: true, userId });
  } catch (error) {
    if (error instanceof ClubError) return apiError(error.message, error.status);
    throw error;
  }
}

/** `{ userId }` → removes an admin (never the last owner). */
export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const got = await managed((await params).handle, request);
  if ("error" in got) return got.error;
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Say who.", 400);
  try {
    await removeMember(got.club.id, parsed.data.userId);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ClubError) return apiError(error.message, error.status);
    throw error;
  }
}
