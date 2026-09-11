import { followedClubIds, managedClubIds } from "@/lib/clubs";
import { serializeClub, type ApiClub } from "@/lib/api/serialize";

/** How a viewer relates to clubs, computed once per request. */
export async function clubViewer(userId: string | null) {
  const [following, managed] = await Promise.all([followedClubIds(userId), managedClubIds(userId)]);
  return { following, managed: new Set(managed) };
}

export async function serializeClubsFor(
  userId: string | null,
  clubs: Parameters<typeof serializeClub>[0][],
): Promise<ApiClub[]> {
  const viewer = await clubViewer(userId);
  return clubs.map((club) => serializeClub(club, viewer));
}
