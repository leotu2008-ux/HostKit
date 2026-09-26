import { followedClubIds, managedClubIds } from "@/lib/clubs";

/** How a viewer relates to clubs, computed once per request. */
export async function clubViewer(userId: string | null) {
  const [following, managed] = await Promise.all([followedClubIds(userId), managedClubIds(userId)]);
  return { following, managed: new Set(managed) };
}
