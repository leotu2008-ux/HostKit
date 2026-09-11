import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { clubViewer } from "@/lib/api/clubs";
import { serializeClub } from "@/lib/api/serialize";
import { ClubError, clubSchema, clubsFor, createClub, suggestedClubs } from "@/lib/clubs";
import { isCity } from "@/lib/catalog";

/** `mine` = clubs you manage; `suggested` = your school's (or city's). */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const rawCity = new URL(request.url).searchParams.get("city");
  const city = isCity(rawCity) ? rawCity : null;
  const [mine, suggested, rel] = await Promise.all([
    viewer ? clubsFor(viewer.id) : Promise.resolve([]),
    suggestedClubs({ schoolDomain: viewer?.schoolDomain ?? null, city }),
    clubViewer(viewer?.id ?? null),
  ]);
  return json({
    mine: mine.map((c) => serializeClub(c, rel)),
    suggested: suggested.map((c) => serializeClub(c, rel)),
  });
}

export async function POST(request: Request) {
  const viewer = await apiUser(request);
  if (!viewer) return apiError("Sign in first.", 401);
  const parsed = clubSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  try {
    const club = await createClub(viewer, parsed.data);
    return json({ club: serializeClub(club, await clubViewer(viewer.id)) }, 201);
  } catch (error) {
    if (error instanceof ClubError) return apiError(error.message, error.status);
    throw error;
  }
}
